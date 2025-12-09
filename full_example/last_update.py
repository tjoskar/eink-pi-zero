"""Last update timestamp section.

Draws a small label bottom-right with the time the panel was rendered.

Usage:
    from last_update import draw_last_update
    draw_last_update(draw, (WIDTH - PADDING, HEIGHT - PADDING))

The provided position acts as a bottom-right anchor; text is right/bottom aligned
by measuring its bounding box.
"""
from __future__ import annotations
from datetime import datetime
from typing import Optional
from lib.gui_constant import colors, text_font

_DEF_FORMAT = "%H:%M:%S"


def draw_last_update(draw, pos, dt: Optional[datetime] = None):
    """Draw the last updated timestamp.

    Args:
        draw: PIL ImageDraw instance.
        pos: (x, y) bottom-right anchor point (typically (WIDTH - PADDING, HEIGHT - PADDING)).
        dt: Optional datetime to use; if None current time is used.
    """
    if dt is None:
        dt = datetime.now()

    # Swedish label prefix
    label = f"{dt.strftime(_DEF_FORMAT)}"
    bbox = draw.textbbox((0, 0), label, font=text_font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    # Right-align and sit just above the passed in bottom-right anchor
    x = pos[0] - text_w
    y = pos[1] - text_h

    draw.text((x, y), label, font=text_font, fill=colors["dark_gray"])  # subtle gray so it doesn't dominate

__all__ = ["draw_last_update"]
