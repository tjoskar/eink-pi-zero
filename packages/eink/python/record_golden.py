#!/usr/bin/env python3
"""
Record what the Python driver sends to the panel, as golden files for the
Node driver's tests (src/driver/__golden__/). Run once, off the Pi:

    uv run --with pillow python packages/eink/python/record_golden.py

epdconfig is replaced by a recorder, so no GPIO or SPI is touched. The
output is what the panel sees, one op per line (see normalize() in
src/hardware.test.ts for the Node side):

    gpio RST 1          RST/PWR writes (DC is implied by cmd/data)
    spi open|close
    cmd 12              a byte sent with DC low
    data 17 17 28 17    consecutive bytes sent with DC high, merged;
    data[48000] <hash>  long runs as length + sha256 prefix
    read BUSY           one BUSY read (the recorder always reads 1 = idle)
    delay 20            consecutive delays, merged
"""

import hashlib
import os
import sys
import types

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "src", "driver")
FIXTURES = os.path.join(SRC, "__fixtures__")
GOLDEN = os.path.join(SRC, "__golden__")

PINS = {17: "RST", 25: "DC", 18: "PWR", 24: "BUSY", 8: "CS"}


class Recorder:
    def __init__(self):
        self.ops = []
        self.dc = 0

    def emit(self, op, payload=None):
        last = self.ops[-1] if self.ops else None
        if op == "data" and last and last[0] == "data":
            last[1].extend(payload)
        elif op == "delay" and last and last[0] == "delay":
            last[1] += payload
        else:
            self.ops.append([op, list(payload) if op == "data" else payload])

    def lines(self):
        out = []
        for op, payload in self.ops:
            if op == "data":
                out.append(format_data(payload))
            elif payload is None:
                out.append(op)
            else:
                out.append(f"{op} {payload}")
        return "\n".join(out) + "\n"


def format_data(data):
    if len(data) <= 16:
        return "data " + " ".join(f"{b:02x}" for b in data)
    digest = hashlib.sha256(bytes(data)).hexdigest()[:16]
    return f"data[{len(data)}] {digest}"


rec = Recorder()


def write_bytes(data):
    data = [b & 0xFF for b in data]  # display() sends ~byte, a negative int
    if rec.dc:
        rec.emit("data", data)
    else:
        for b in data:
            rec.emit("cmd", f"{b:02x}")


def digital_write(pin, value):
    name = PINS[pin]
    if name == "DC":
        rec.dc = 1 if value else 0
    elif name != "CS":
        rec.emit("gpio", f"{name} {1 if value else 0}")


def digital_read(pin):
    rec.emit("read", PINS[pin])
    return 1


def module_init(cleanup=False):
    rec.emit("gpio", "PWR 1")
    rec.emit("spi", "open")
    return 0


def module_exit(cleanup=False):
    rec.emit("spi", "close")
    rec.emit("gpio", "RST 0")
    rec.dc = 0
    rec.emit("gpio", "PWR 0")


fake = types.ModuleType("epdconfig")
fake.RST_PIN, fake.DC_PIN, fake.CS_PIN, fake.BUSY_PIN, fake.PWR_PIN = 17, 25, 8, 24, 18
fake.digital_write = digital_write
fake.digital_read = digital_read
fake.delay_ms = lambda ms: rec.emit("delay", ms)
fake.spi_writebyte = write_bytes
fake.spi_writebyte2 = write_bytes
fake.SPI = types.SimpleNamespace(writebytes2=write_bytes)
fake.module_init = module_init
fake.module_exit = module_exit
sys.modules["epdconfig"] = fake
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402
from epd7in5_v2 import EPD  # noqa: E402


def record(name, run):
    global rec
    rec = Recorder()
    run(EPD())
    with open(os.path.join(GOLDEN, f"{name}.txt"), "w") as f:
        f.write(rec.lines())
    print(f"{name}: {len(rec.ops)} ops")


mono = Image.open(os.path.join(FIXTURES, "mono.png"))
gray4 = Image.open(os.path.join(FIXTURES, "gray4.png"))


def mono_clear(epd):  # hardware_daemon.py handle_render, clear=True
    epd.init()
    epd.Clear()
    epd.display(epd.getbuffer(mono))
    epd.sleep()


def mono_normal(epd):
    epd.init()
    epd.display(epd.getbuffer(mono))
    epd.sleep()


def mono_fast(epd):
    epd.init_fast()
    epd.display(epd.getbuffer(mono))
    epd.sleep()


def gray4_render(epd):
    epd.init_4Gray()
    epd.display_4Gray(epd.getbuffer_4Gray(gray4))
    epd.sleep()


os.makedirs(GOLDEN, exist_ok=True)
record("mono-clear", mono_clear)
record("mono-normal", mono_normal)
record("mono-fast", mono_fast)
record("gray4", gray4_render)
