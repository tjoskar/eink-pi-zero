"""
MQTT-based device panel renderer for e-ink display.

This file is intended for local development and debugging purposes.
It allows testing the MQTT message handling and image generation functionality
without requiring the actual e-ink hardware to be connected.

The module connects to an MQTT broker, subscribes to device state topics,
and generates PNG images showing device status icons whenever state changes
are received.
Usage:
    python main_dev.py
Then open the generated 'devices.png' file to see the current device states
and then publish MQTT messages to see the image update accordingly.
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent)) # Adds the current path to sys.path to import config.settings

import paho.mqtt.client as mqtt
from config.settings import (
    MQTT_HOST, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD, MQTT_TOPIC_PREFIX
)
from PIL import Image, ImageDraw
from device import draw_device_icons, update_device_by_topic

WIDTH, HEIGHT = 800, 480
PADDING = 16

def compose_panel():
    image = Image.new("L", (WIDTH, HEIGHT), 255)
    draw = ImageDraw.Draw(image)

    draw_device_icons(draw, (PADDING, PADDING))
    return image

def on_connect(client, userdata, flags, rc):
    print(f"Connected with result code {rc}")
    if MQTT_TOPIC_PREFIX:
        topic = f"{MQTT_TOPIC_PREFIX}/#"
        client.subscribe(topic)
        print(f"Subscribed to {topic}")

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode("utf-8")
        print(f"Received message on {msg.topic}: {payload}")

        is_on = payload.lower() == "on"

        updated_device = update_device_by_topic(msg.topic, is_on)

        if updated_device:
            print(f"Device {updated_device['label']} updated. Regenerating image...")
            panel_image = compose_panel()
            panel_image.save("devices.png")
            print("Image saved to devices.png")
    except Exception as e:
        print(f"Error processing message: {e}")

if __name__ == "__main__":
    # Initial render
    panel_image = compose_panel()
    panel_image.save("devices.png")
    print("Initial image saved.")

    client = mqtt.Client()
    if MQTT_USERNAME and MQTT_PASSWORD:
        client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

    client.on_connect = on_connect
    client.on_message = on_message

    print(f"Connecting to MQTT broker at {MQTT_HOST}:{MQTT_PORT}...")
    try:
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        client.loop_forever()
    except KeyboardInterrupt:
        print("Exiting...")
    except Exception as e:
        print(f"Error: {e}")
