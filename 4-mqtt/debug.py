"""Simple MQTT debugging script.

Connects to the broker defined in config.py (MQTT_HOST, MQTT_PORT), subscribes to all
topics ("#") and prints every received message with timestamp.

Usage:
    python mqtt_debug.py
"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent)) # Adds the current path to sys.path to import config.settings

import json
from datetime import datetime
import paho.mqtt.client as mqtt
from config.settings import (
    MQTT_HOST,
    MQTT_PORT,
    MQTT_USERNAME,
    MQTT_PASSWORD,
)

# Simple helpers
def _ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def _interpret_payload(raw: bytes):
    """Try to decode payload into a useful Python object.
    - UTF-8 decode
    - Attempt JSON if starts with '{' or '['
    - Normalize common boolean strings
    """
    try:
        text = raw.decode("utf-8", errors="replace").strip()
    except Exception:
        return raw

    if not text:
        return ""  # empty

    lowered = text.lower()
    if lowered in {"on", "off", "true", "false", "1", "0"}:
        if lowered in {"on", "true", "1"}:
            return True
        return False

    if text[0] in "[{" and text[-1] in "]}":
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    return text


def on_connect(client: mqtt.Client, userdata, flags, rc):  # type: ignore[override]
    if rc == 0:
        print(f"[{_ts()}] Connected to MQTT {MQTT_HOST}:{MQTT_PORT}")
        sub_pattern = "#"
        client.subscribe(sub_pattern)
        print(f"[{_ts()}] Subscribed to '{sub_pattern}'")
    else:
        print(f"[{_ts()}] Connection failed (rc={rc})", file=sys.stderr)


def on_message(client: mqtt.Client, userdata, msg: mqtt.MQTTMessage):  # type: ignore[override]
    payload_obj = _interpret_payload(msg.payload)
    base_line = f"[{_ts()}] TOPIC={msg.topic} QOS={msg.qos} RETAIN={int(msg.retain)} PAYLOAD={payload_obj!r}"
    print(base_line)


def main():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message

    # Apply credentials if provided
    if MQTT_USERNAME is not None:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD or "")

    try:
        client.connect(MQTT_HOST, MQTT_PORT, keepalive=60)
    except Exception as e:
        print(f"[{_ts()}] Could not connect to MQTT broker {MQTT_HOST}:{MQTT_PORT} -> {e}", file=sys.stderr)
        sys.exit(1)

    # Blocking loop; Ctrl+C to exit
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print(f"[{_ts()}] Interrupted; disconnecting...")
    finally:
        try:
            client.disconnect()
        except Exception:
            pass


if __name__ == "__main__":
    main()
