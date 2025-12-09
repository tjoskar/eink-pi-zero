"""Device rendering & state utilities.

Maintains an in-memory mutable copy of devices defined in `config.py`.
Each device dict contains: label, topic, icon glyph, and current boolean `on`.
"""
from PIL import Image, ImageDraw
from lib.gui_constant import colors, icon_size, icon_font
from config.settings import DEVICES_CONFIG

# Global in-memory device list initialized from config
DEVICES = [
    {"label": d["label"], "icon": d["icon"], "on": d["on"], "topic": d["topic"]}
    for d in DEVICES_CONFIG
]

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


def update_device_by_topic(topic, on):
    """Update state for device matching MQTT `topic`; return device dict or None."""
    for d in DEVICES:
        on_bool = bool(on)
        if d.get("topic") == topic and d.get("on") != on_bool:
            print(f"[DEVICE] Updating '{d.get('label')}' ({topic}) to {'ON' if on else 'OFF'}")
            d["on"] = on_bool
            return d
    return None

__all__ = [
    "draw_device_icons",
    "update_device_by_topic",
]
