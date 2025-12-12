"""Hardware display runner: MQTT + periodic refresh + button toggle."""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

import time
import sys
import threading
import signal
import paho.mqtt.client as mqtt
try:  # pragma: no cover - import guard
    from gpiozero import Button  # type: ignore
except Exception:  # noqa: BLE001
    Button = None  # type: ignore

from config.settings import (
    MQTT_DEVICE_TOPICS,
    MQTT_HOST,
    MQTT_PORT,
    MQTT_USERNAME,
    MQTT_PASSWORD,
    MQTT_TOPIC_PREFIX,
)
from devices import update_device_by_topic, find_engine_heater, set_engine_heater
from display_controller import DisplayController
from driver.epd7in5_v2 import EPD

def button_listener(controller: DisplayController, client: mqtt.Client):
    button = Button(21, pull_up=True, bounce_time=0.05)

    def handle_press():
        mv_device = find_engine_heater()
        if mv_device is None:
            print("[BUTTON] 'Motorvärmare' device not found; ignoring press")
            return
        currently_on = bool(mv_device.get("on"))
        if currently_on:
            set_engine_heater(False)
            try:
                client.publish("statechange/request/engine_heater", "off", retain=False)
            except Exception as e:
                print(f"[BUTTON][MQTT] Publish failed: {e}")
            controller.show_dialog("Motorvärmaren har stängts av")
        else:
            set_engine_heater(True)
            try:
                client.publish("statechange/request/engine_heater", "on", retain=False)
            except Exception as e:
                print(f"[BUTTON][MQTT] Publish failed: {e}")
            controller.show_dialog("Motorvärmaren har startats")

    button.when_pressed = handle_press
    print("[BUTTON] Listener started (GPIO21)")
    while not controller.stopped:
        time.sleep(0.2)
    # Cleanup implicit: gpiozero devices auto close on GC.
    print("[BUTTON] Listener stopped")

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("[MQTT] Connected")
        if MQTT_TOPIC_PREFIX:
            wildcard = f"{MQTT_TOPIC_PREFIX}/#"
            client.subscribe(wildcard)
            print(f"[MQTT] Subscribed to {wildcard}")
        for t in MQTT_DEVICE_TOPICS:
            client.subscribe(t)
            print(f"[MQTT] Subscribed to {t}")
    else:
        print(f"[MQTT] Connect failed rc={rc}")


def on_message(client, userdata, msg):
    topic = msg.topic
    payload = msg.payload.decode("utf-8").strip().lower()

    if topic in MQTT_DEVICE_TOPICS and payload in {"on", "off"}:
        updated = update_device_by_topic(topic, payload == "on")
        if updated and userdata:
            userdata.fast_render()

def main():
    print("[INIT] Starting display runner (E-Ink mode)")
    epd = EPD()
    controller = DisplayController(epd)
    controller.render()

    client = mqtt.Client(userdata=controller)
    # Apply credentials if configured
    if MQTT_USERNAME is not None:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD or "")
    client.on_connect = on_connect
    client.on_message = on_message

    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
    except Exception as e:
        print(f"[ERROR] MQTT connection failed: {e}")
        sys.exit(1)

    client.loop_start()

    # Periodic full refresh (fixed 1h)
    stop_event = threading.Event()
    def refresh_loop():
        while not stop_event.is_set():
            time.sleep(3600)  # fixed 1h
            if stop_event.is_set():
                break
            controller.render()
    threading.Thread(target=refresh_loop, daemon=True).start()
    threading.Thread(target=button_listener, args=(controller, client), daemon=True).start()

    # Unified shutdown routine
    def shutdown(reason: str):
        print(f"\n[SHUTDOWN] {reason}...")
        stop_event.set()
        controller.stop()
        try:
            client.loop_stop()
        except Exception:
            pass
        try:
            client.disconnect()
        except Exception:
            pass
        print("[SHUTDOWN] Done")

    # Signal handlers (SIGINT, SIGTERM)
    def handle_signal(signum, frame):
        name = {signal.SIGINT: "SIGINT", signal.SIGTERM: "SIGTERM"}.get(signum, str(signum))
        shutdown(f"Received {name}")
        # Exit immediately after cleanup
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    print("[RUNNING] Press Ctrl+C or send SIGTERM to exit")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        shutdown("KeyboardInterrupt")
    except Exception as e:
        shutdown(f"Unhandled exception: {e}")


if __name__ == "__main__":
    main()
