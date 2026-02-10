import os
import json
import time
import urllib.request
import urllib.error
from lib.gui_constant import colors, text_font, text_size
from config.settings import CACHE_DURATION, API_TIMEOUT, DISHES_API_URL

# Cache file path co-located with this script
_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dishes_cache.json")

def _read_cache():
    try:
        if os.path.exists(_CACHE_FILE):
            with open(_CACHE_FILE, "r") as f:
                data = json.load(f)
            if time.time() - data.get("timestamp", 0) < CACHE_DURATION:
                cached_list = data.get("dishes", [])
                if isinstance(cached_list, list) and cached_list:
                    return cached_list
    except Exception as e:
        print(f"dishes cache read error: {e}")
    return None

def _write_cache(dishes_list):
    try:
        tmp_path = _CACHE_FILE + ".tmp"
        with open(tmp_path, "w") as f:
            json.dump({"timestamp": time.time(), "dishes": dishes_list}, f)
        os.replace(tmp_path, _CACHE_FILE)  # atomic replace
    except Exception as e:
        print(f"dishes cache write error: {e}")

def _fetch_remote_dishes():
    """Fetch list of dish names from remote endpoint.

    Expected response JSON example: ["pasta", "korv"]
    Returns list[str] or None on failure.
    """
    url = DISHES_API_URL
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as resp:
            raw = resp.read().decode("utf-8")
        data = json.loads(raw)
        if isinstance(data, list):
            return data
    except urllib.error.HTTPError as e:
        print(f"dishes HTTP error {e.code}: {e.reason}")
    except urllib.error.URLError as e:
        print(f"dishes URL error: {e.reason}")
    except Exception as e:
        print(f"dishes fetch error: {e}")
    return None

def get_dishes():
    # 1. Try cache
    dishes_list = _read_cache()

    # 2. If no valid cache, attempt remote fetch
    if dishes_list is None:
        fetched = _fetch_remote_dishes()
        if fetched:
            _write_cache(fetched)
            return fetched

    return dishes_list


def _truncate(text: str, limit: int = 40) -> str:
    """Truncate a dish name to fit layout if it exceeds limit.

    Uses an ellipsis (…); keeps total length <= limit. Strips trailing spaces before adding ellipsis.
    """
    if len(text) <= limit:
        return text
    # Reserve 1 char for ellipsis
    cut = max(0, limit - 1)
    return text[:cut].rstrip() + "…"

def draw_weekly_dishes(draw, pos):
    # Draw section title
    draw.text((pos[0], pos[1]), "Veckans mat", font=text_font, fill=colors["black"])

    # Dynamic data retrieval (cached remote or fallback)
    dishes = get_dishes()

    # Calculate positions and spacing
    title_height = text_size + 8
    dish_height = text_size + 4
    start_y = pos[1] + title_height

    # Draw each dish (keeping original style: bullet without day label for compactness)
    for i, item in enumerate(dishes):
        dish_y = start_y + i * dish_height
        dish_text = _truncate(item, 40)
        draw.text((pos[0], dish_y), "- " + dish_text, font=text_font, fill=colors["black"])

def get_text_width(draw, text, font):
    bbox = draw.textbbox((0, 0), text, font=font)
    return bbox[2] - bbox[0]
