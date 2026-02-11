#!/usr/bin/env python3
"""
Hardware Daemon - Persistent process for all hardware I/O via stdin/stdout JSON IPC.

Handles:
- LED control (multiple pins)
- Button events with debounce (multiple pins via subscribe)
- E-ink display rendering (lazy initialization)

Protocol (JSON, one message per line):

Node → Python:
  {"cmd": "button_subscribe", "pin": 21}
  {"cmd": "led", "pin": 13, "on": true}
  {"cmd": "render", "path": "/tmp/img.png", "fast": true, "clear": false}
  {"cmd": "shutdown"}

Python → Node:
  {"event": "ready"}
  {"event": "button", "pin": 21}
  {"response": "ok", "cmd": "led"}
  {"response": "ok", "cmd": "render"}
  {"error": "message"}

Dependencies (install via apt):
  sudo apt install python3-pil python3-spidev python3-gpiozero
"""

import sys
import json
import signal
import select

from gpiozero import LED, Button
from PIL import Image

# Import the Waveshare driver (same directory)
from epd7in5_v2 import EPD

# Debounce time for buttons (seconds)
BUTTON_DEBOUNCE_SEC = 0.05

# Display dimensions
DISPLAY_WIDTH = 800
DISPLAY_HEIGHT = 480

# Global state - GPIO
leds: dict[int, LED] = {}  # pin -> LED
buttons: dict[int, Button] = {}  # pin -> Button

# Global state - E-ink display (lazy init)
epd: EPD | None = None
epd_initialized: bool = False

# Running flag
running = True


# =============================================================================
# IPC Helpers
# =============================================================================

def send_message(msg: dict) -> None:
    """Send JSON message to stdout."""
    print(json.dumps(msg), flush=True)


def send_error(message: str) -> None:
    """Send error message to stdout."""
    send_message({"error": message})


def send_response(cmd: str) -> None:
    """Send OK response for a command."""
    send_message({"response": "ok", "cmd": cmd})


# =============================================================================
# LED Handling
# =============================================================================

def handle_led(pin: int, on: bool) -> None:
    """Set LED state on given pin."""
    global leds

    try:
        # If we don't have this pin open yet, create LED
        if pin not in leds:
            leds[pin] = LED(pin)

        # Set the value
        if on:
            leds[pin].on()
        else:
            leds[pin].off()

        send_response("led")

    except Exception as e:
        send_error(f"LED error on pin {pin}: {e}")


# =============================================================================
# Button Handling
# =============================================================================

def make_button_callback(pin: int):
    """Create a callback function for a button pin."""
    def callback():
        send_message({"event": "button", "pin": pin})
    return callback


def handle_button_subscribe(pin: int) -> None:
    """Subscribe to button events on given pin."""
    global buttons

    try:
        # Check if already subscribed
        if pin in buttons:
            send_response("button_subscribe")
            return

        # Create button with pull-up and debounce
        button = Button(pin, pull_up=True, bounce_time=BUTTON_DEBOUNCE_SEC)
        button.when_pressed = make_button_callback(pin)
        buttons[pin] = button

        send_response("button_subscribe")

    except Exception as e:
        send_error(f"Button subscribe error on pin {pin}: {e}")


# =============================================================================
# E-ink Display Handling
# =============================================================================

def init_display(fast: bool = False) -> None:
    """Initialize the e-ink display (lazy, only called when needed)."""
    global epd, epd_initialized

    if epd is None:
        epd = EPD()

    if fast:
        epd.init_fast()
    else:
        epd.init()

    epd_initialized = True


def handle_render(path: str, fast: bool = False, clear: bool = False) -> None:
    """Render an image to the e-ink display."""
    global epd, epd_initialized

    try:
        # Load image
        image = Image.open(path)

        # Resize if needed
        if image.size != (DISPLAY_WIDTH, DISPLAY_HEIGHT):
            image = image.resize(
                (DISPLAY_WIDTH, DISPLAY_HEIGHT),
                Image.Resampling.LANCZOS
            )

        # Initialize display (lazy)
        init_display(fast=fast)

        # Clear if requested
        if clear:
            epd.Clear()

        # Render image
        epd.display(epd.getbuffer(image))

        # Put display to sleep
        epd.sleep()

        send_response("render")

    except FileNotFoundError:
        send_error(f"Render error: Image not found: {path}")
    except Exception as e:
        # Try to sleep display even on error
        try:
            if epd is not None:
                epd.sleep()
        except Exception:
            pass
        send_error(f"Render error: {e}")


# =============================================================================
# Shutdown and Cleanup
# =============================================================================

def handle_shutdown() -> None:
    """Clean shutdown."""
    global running
    running = False
    send_response("shutdown")


def cleanup() -> None:
    """Release all hardware resources."""
    global leds, buttons, epd, epd_initialized, running

    running = False

    # Close LEDs
    for pin, led in leds.items():
        try:
            led.close()
        except Exception:
            pass
    leds.clear()

    # Close buttons
    for pin, button in buttons.items():
        try:
            button.close()
        except Exception:
            pass
    buttons.clear()

    # Sleep e-ink display
    if epd is not None and epd_initialized:
        try:
            epd.sleep()
        except Exception:
            pass
        epd = None
        epd_initialized = False


def signal_handler(signum, frame):
    """Handle termination signals."""
    cleanup()
    sys.exit(0)


# =============================================================================
# Command Processing
# =============================================================================

def process_command(line: str) -> bool:
    """Process a single command. Returns False if should shutdown."""
    try:
        msg = json.loads(line)
        cmd = msg.get("cmd")

        if cmd == "led":
            pin = msg.get("pin")
            on = msg.get("on", False)
            if pin is None:
                send_error("led command requires 'pin'")
            else:
                handle_led(int(pin), bool(on))

        elif cmd == "button_subscribe":
            pin = msg.get("pin")
            if pin is None:
                send_error("button_subscribe command requires 'pin'")
            else:
                handle_button_subscribe(int(pin))

        elif cmd == "render":
            path = msg.get("path")
            if path is None:
                send_error("render command requires 'path'")
            else:
                fast = msg.get("fast", False)
                clear = msg.get("clear", False)
                handle_render(str(path), bool(fast), bool(clear))

        elif cmd == "shutdown":
            handle_shutdown()
            return False

        else:
            send_error(f"Unknown command: {cmd}")

    except json.JSONDecodeError as e:
        send_error(f"Invalid JSON: {e}")
    except Exception as e:
        send_error(f"Command error: {e}")

    return True


# =============================================================================
# Main
# =============================================================================

def main() -> None:
    global running

    # Set up signal handlers
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    try:
        # Signal ready
        send_message({"event": "ready"})

        # Main loop - read commands from stdin
        # Use select to allow gpiozero callbacks to run
        while running:
            # Check if there's input available (timeout allows callbacks to run)
            if select.select([sys.stdin], [], [], 0.1)[0]:
                line = sys.stdin.readline()
                if not line:
                    # EOF - stdin closed
                    break
                line = line.strip()
                if line:
                    if not process_command(line):
                        break

    except Exception as e:
        send_error(f"Fatal error: {e}")
        sys.exit(1)

    finally:
        cleanup()


if __name__ == "__main__":
    main()
