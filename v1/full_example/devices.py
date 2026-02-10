"""Device rendering & state utilities.

Maintains an in-memory mutable copy of devices defined in `config.py`.
Each device dict contains: label, topic, icon glyph, and current boolean `on`.
"""

from PIL import Image, ImageDraw
from lib.gui_constant import colors, icon_size, icon_font
from config.settings import DEVICES_CONFIG

# Optional hardware LED (GPIO2) to indicate Motorvärmare status (ignored if unavailable).
try:
    from gpiozero import LED  # type: ignore
    _motor_led = LED(13)
except Exception:  # broad: ImportError or runtime error creating LED
    _motor_led = None  # Fallback: no hardware available

MOTOR_LABEL = "Motorvärmare"

def set_engine_heater(on: bool):
    """Turn LED on/off (if hardware available) and update device state."""
    _motor_device = find_engine_heater()
    if _motor_led is None or _motor_device is None:
        return
    try:
        if on:
            _motor_device["on"] = True
            _motor_led.on()
        else:
            _motor_device["on"] = False
            _motor_led.off()
    except Exception:
        # Silently ignore GPIO runtime errors (e.g., permissions)
        pass

# Global in-memory device list initialized from config
DEVICES = [
    {"label": d["label"], "icon": d["icon"], "on": d["on"], "topic": d["topic"]}
    for d in DEVICES_CONFIG
]

def find_engine_heater():
    for d in DEVICES:
        if d.get("label") == "Motorvärmare":
            return d
    return None

def draw_device_icons(draw, pos):
    """Draw vertical list of device icons at anchor `pos` (x, y)."""
    box_padding = 4
    box_height = icon_size + box_padding * 2

    icon_y_offset = pos[1]
    for device in DEVICES:
        y = icon_y_offset
        icon_color = colors["black"] if device.get("on") else colors["light_gray"]
        draw.text((pos[0], y), device.get("icon", "?"), font=icon_font, fill=icon_color)

        icon_y_offset += box_height

def get_devices_region(padding, full_height):
    """Return (region_image, bbox) for devices column given panel padding/height."""
    devices_width = icon_size * 2  # conservative 2-column width
    bbox = (padding, padding, padding + devices_width, full_height - padding)
    region_img_height = full_height - 2 * padding
    region_img = Image.new("L", (devices_width, region_img_height), colors["white"])
    region_draw = ImageDraw.Draw(region_img)
    draw_device_icons(region_draw, (0, 0))
    return region_img, bbox


def update_device_by_topic(topic, on):
    """Update state for device matching MQTT `topic`; return device dict or None."""
    for d in DEVICES:
        on_bool = bool(on)
        if d.get("topic") == topic and d.get("on") != on_bool:
            print(f"[DEVICE] Updating '{d.get('label')}' ({topic}) to {'ON' if on else 'OFF'}")
            d["on"] = on_bool
            if d.get("label") == MOTOR_LABEL:
                set_engine_heater(on_bool)
            return d
    return None

__all__ = [
    "find_engine_heater",
    "draw_device_icons",
    "update_device_by_topic",
    "DEVICES",
    "get_devices_region",
    "set_engine_heater",
]
