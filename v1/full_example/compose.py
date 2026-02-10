"""Single source for panel layout (devices, weather, electricity, dishes, garbage).

Both PNG generation (`to_image.py`) and hardware display (`to_display.py`) must
use `compose_panel()` so the layout stays in sync.

Keep layout constants (WIDTH/HEIGHT/PADDING) here to avoid magic numbers.
Each draw_* function receives a shared ImageDraw instance and top‑left anchor.
Sections are resilient: failures are caught and logged.
"""

from PIL import Image, ImageDraw
from devices import draw_device_icons
from fetch_example.weather import draw_weather
from electricity_price import draw_electricity_price
from dishes import draw_weekly_dishes
from garbage import draw_garbage_collection
from last_update import draw_last_update
from typing import Callable

WIDTH, HEIGHT = 800, 480
PADDING = 16

def _safe(func: Callable, label: str, *args, **kwargs):
    """Execute a drawing function; log and continue on any error."""
    try:
        func(*args, **kwargs)
    except Exception as e:  # noqa: BLE001 (broad ok: we want to catch all rendering issues)
        print(f"[COMPOSE][ERROR] Section '{label}' failed: {e}")


def compose_panel():
    """Return a fully rendered grayscale PIL Image ready for saving or display."""
    image = Image.new("L", (WIDTH, HEIGHT), 255)
    draw = ImageDraw.Draw(image)

    # Devices (left column)
    _safe(draw_device_icons, "devices", draw, (PADDING, PADDING))

    # Weather (center-left)
    _safe(draw_weather, "weather", draw, (PADDING + 36 * 2, PADDING))

    # Electricity price + consumption (right top)
    _safe(draw_electricity_price, "electricity", draw, (PADDING + 500, PADDING))

    # Weekly dishes (below weather)
    _safe(draw_weekly_dishes, "dishes", draw, (PADDING + 36 * 2, PADDING + 270))

    # Garbage collection (below electricity charts)
    _safe(draw_garbage_collection, "garbage", draw, (PADDING + 500, PADDING + 280))

    # Last updated timestamp (bottom-right corner)
    _safe(draw_last_update, "last_update", draw, (WIDTH - PADDING, HEIGHT - PADDING))

    return image

__all__ = ["compose_panel", "WIDTH", "HEIGHT", "PADDING"]
