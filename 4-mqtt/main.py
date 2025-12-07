"""
E-ink display controller with MQTT integration.

This module connects to an MQTT broker and updates an e-ink display (EPD 7.5" v2)
based on incoming messages. It displays device icons that reflect their on/off state,
which are updated in real-time when MQTT messages are received on subscribed topics.

The display uses fast refresh for updates to minimize latency, with the understanding
that periodic full refreshes would be needed in production to prevent ghosting.
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent)) # Adds the current path to sys.path to import config.settings

from driver.epd7in5_v2 import EPD
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

            epd = userdata
            # Use fast init for subsequent updates, however this might lead to
            # ghosting over time so a full init and clear periodically is highly
            # recommended!
            # But this is fine in this demo context.
            epd.init_fast()
            epd.display(epd.getbuffer(panel_image))
            epd.sleep()
            print("Display updated.")
    except Exception as e:
        print(f"Error processing message: {e}")

if __name__ == "__main__":
    # Initial render
    epd = EPD()
    epd.init()
    epd.Clear()
    panel_image = compose_panel()
    image = compose_panel()
    epd.display(epd.getbuffer(image))
    epd.sleep()

    client = mqtt.Client(userdata=epd)
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
