import os
import json
import time
from datetime import datetime, timezone
import urllib.request
import urllib.error
from lib.gui_constant import colors, text_font
from config.settings import TIBBER_TOKEN

# Cache settings
# Dynamic behavior:
#  - Between 13:00 and 15:00 (local time) new prices for next day are published.
#    Use a short TTL (5 minutes) to refetch frequently so we pick up the update soon after release.
#  - Outside that window, keep and reuse whatever we have (yesterday's fetch contains today's prices
#    in the 'tomorrow' array; after 15:00 it also contains tomorrow's prices). Age is ignored.
ELECTRICITY_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "electricity_cache.json")
ELECTRICITY_SHORT_WINDOW_TTL = 300  # 5 minutes (13-15 window)
ELECTRICITY_MAX_AGE = 86400  # 24h hard expiry; always refetch if older

# GraphQL query (price info + last 7 days consumption)
TIBBER_QUERY = """
{\n  viewer {\n    homes {\n      currentSubscription {\n        priceInfo {\n          today {\n            total\n            startsAt\n            level\n          }\n          tomorrow {\n            total\n            startsAt\n            level\n          }\n        }\n      }\n      consumption(resolution: DAILY, last: 7) {\n        nodes {\n          cost\n          consumption\n        }\n      }\n    }\n  }\n}\n"""

LEVEL_LABEL_SV = {
    "NORMAL": "Normalt",
    "CHEAP": "Billigt",
    "VERY_CHEAP": "Mycket billigt",
    "EXPENSIVE": "Dyrt",
    "VERY_EXPENSIVE": "Mycket dyrt"
}


def _load_electricity_cache():
    """Return cached data subject to dynamic time-window logic.

    Between 13:00 and 15:00 (local time) enforce a short TTL (5 minutes).
    Outside that window, if a cache file exists return its data regardless of age.
    This matches Tibber day-ahead price publication timing (released sometime 13-15).
    """
    try:
        if not os.path.exists(ELECTRICITY_CACHE_FILE):
            return None
        with open(ELECTRICITY_CACHE_FILE, 'r') as f:
            cache = json.load(f)
        data = cache.get('data')
        if data is None:
            return None

        now_hour = time.localtime().tm_hour  # rely on system timezone (should be Europe/Stockholm on Pi)
        cache_age = time.time() - cache.get('timestamp', 0)

        # Hard age cap: if older than 24h force refresh regardless of window
        if cache_age > ELECTRICITY_MAX_AGE:
            return None

        # Short refresh window: 13:00 <= time < 15:00
        if 13 <= now_hour < 15:
            if cache_age < ELECTRICITY_SHORT_WINDOW_TTL:
                return data
            return None  # force refetch inside the short window when stale (>5m)

        # Outside publication window reuse any age (up to MAX_AGE)
        return data
    except Exception as e:
        print(f"Error reading electricity cache: {e}")
        return None

def _save_electricity_cache(data):
    try:
        with open(ELECTRICITY_CACHE_FILE, 'w') as f:
            json.dump({"timestamp": time.time(), "data": data}, f)
    except Exception as e:
        print(f"Error writing electricity cache: {e}")

def _fetch_tibber_prices():
    """Return (data_dict, error_code). error_code may be HTTP status or None."""
    if not TIBBER_TOKEN:
        # No token configured
        return None, 401
    try:
        url = "https://api.tibber.com/v1-beta/gql"
        body = json.dumps({"query": TIBBER_QUERY}).encode('utf-8')
        req = urllib.request.Request(url, data=body, method='POST')
        req.add_header('Content-Type', 'application/json')
        req.add_header('Authorization', f'Bearer {TIBBER_TOKEN}')
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                return None, resp.status
            data = json.loads(resp.read().decode('utf-8'))
            return data, None
    except urllib.error.HTTPError as e:
        return None, e.code
    except urllib.error.URLError as e:
        print(f"Electricity price URL Error: {e.reason}")
        return None, None
    except Exception as e:
        print(f"Unexpected electricity fetch error: {e}")
        return None, None

def get_electricity_price_data():
    """Return tuple: (prices_list, entries, highlight_idx, level_label, consumption_kwh, consumption_costs, error_code)."""
    # Try cache
    cached = _load_electricity_cache()
    error_code = None
    if cached:
        source_data = cached
    else:
        fetched, error_code = _fetch_tibber_prices()
        if fetched:
            source_data = fetched
            _save_electricity_cache(fetched)
        else:
            # If fetch failed but cache exists (already handled) else return empty
            source_data = None

    if not source_data:
        return [], [], -1, "", [], [], error_code

    try:
        homes = source_data.get('data', {}).get('viewer', {}).get('homes', [])
        if not homes:
            return [], [], -1, "", [], [], error_code
        price_info = homes[0].get('currentSubscription', {}).get('priceInfo', {})
        today = price_info.get('today', []) or []
        tomorrow = price_info.get('tomorrow', []) or []
        combined = today + tomorrow

        processed = []
        for entry in combined:
            total = entry.get('total', 0)  # Price in SEK/kWh presumably; spec says multiply by 100
            starts_at = entry.get('startsAt')
            level = entry.get('level', '')
            # Convert to öre: multiply by 100 and truncate decimals
            price_ore = int(total * 100)
            processed.append({
                'total_ore': price_ore,
                'startsAt': starts_at,
                'level': level
            })

        # Determine highlight index: entry whose startsAt <= now < next startsAt
        now = datetime.now(timezone.utc)
        highlight_index = -1
        for i, entry in enumerate(processed):
            try:
                starts = datetime.fromisoformat(entry['startsAt'].replace('Z', '+00:00'))
            except Exception:
                continue
            # Determine end boundary
            if i + 1 < len(processed):
                try:
                    next_starts = datetime.fromisoformat(processed[i+1]['startsAt'].replace('Z', '+00:00'))
                except Exception:
                    next_starts = starts
            else:
                next_starts = starts
            if starts <= now < next_starts:
                highlight_index = i
                break
        level_label = ""
        if 0 <= highlight_index < len(processed):
            level_label = LEVEL_LABEL_SV.get(processed[highlight_index]['level'], processed[highlight_index]['level'])

        prices_list = [p['total_ore'] for p in processed]
        # Extract consumption nodes from same response
        nodes = homes[0].get('consumption', {}).get('nodes', [])
        consumption_values = []
        consumption_costs = []
        for n in nodes:
            c = n.get('consumption')
            cost = n.get('cost')
            if c is not None:
                try:
                    consumption_values.append(float(c))
                except ValueError:
                    pass
            if cost is not None:
                try:
                    consumption_costs.append(float(cost))
                except ValueError:
                    pass
        return prices_list, processed, highlight_index, level_label, consumption_values, consumption_costs, error_code
    except Exception as e:
        print(f"Error processing Tibber price data: {e}")
        return [], [], -1, "", [], [], error_code

def draw_price_chart(draw, pos, width, height, prices, highlight_index):
    # Step chart (prices)
    chart_width = width
    chart_height = height - 30

    # Scaling
    if not prices:
        return  # Nothing to draw
    max_price = max(prices)
    min_price = min(prices)
    y_scaling = chart_height / (max_price - min_price) if max_price != min_price else 1
    x_scaling = chart_width / (len(prices) - 1) if len(prices) > 1 else 1

    # y labels
    y_labels = [min_price, (max_price + min_price) / 2, max_price]
    for i, label in enumerate(y_labels):
        y_pos = pos[1] + chart_height - (label - min_price) * y_scaling
        draw.text((pos[0], y_pos - 6), f"{label:.0f}", font=text_font, fill=colors["black"])

    # Points
    points = []
    for i, p in enumerate(prices):
        x = pos[0] + 30 + i * x_scaling
        y = pos[1] + chart_height - (p - min_price) * y_scaling
        points.append((x, y))

    # Step chart
    if len(points) > 1:
        for i in range(len(points) - 1):
            # Draw horizontal line from current point to below the next point
            draw.line([(points[i][0], points[i][1]), (points[i+1][0], points[i][1])],
                      fill=colors["black"], width=2)

            # Draw vertical line from below the next point to the next point
            draw.line([(points[i+1][0], points[i][1]), (points[i+1][0], points[i+1][1])],
                      fill=colors["black"], width=2)

    # Highlight dot
    if 0 <= highlight_index < len(points):
        highlight_point = points[highlight_index]
        draw.ellipse((highlight_point[0] - 3, highlight_point[1] - 3,
                      highlight_point[0] + 3, highlight_point[1] + 3),
                     fill=colors["black"])


def draw_consumption_chart(draw, pos, width, height, consumption, costs):
    # Bar chart (daily consumption)
    chart_width = width
    chart_height = height

    # Scaling
    if not consumption:
        return
    max_consumption = max(consumption)
    y_scaling = chart_height / max_consumption if max_consumption > 0 else 1

    # Bar geometry
    bar_width = int(chart_width / len(consumption)) - 4  # 4px gap between bars

    # Title
    draw.text((pos[0], pos[1] - 30), "Förbrukning (kWh, kr)", font=text_font, fill=colors["black"])

    # y labels
    y_labels = [max_consumption / 2, max_consumption]
    for i, label in enumerate(y_labels):
        y_pos = pos[1] + chart_height - (label * y_scaling)
        draw.text((pos[0], y_pos - 6), f"{label:.1f}", font=text_font, fill=colors["black"])

    # Bars + cost labels
    for i, value in enumerate(consumption):
        bar_height = value * y_scaling
        x1 = pos[0] + 35 + i * (bar_width + 4)  # 4px gap
        y1 = pos[1] + chart_height - bar_height
        x2 = x1 + bar_width
        y2 = pos[1] + chart_height

        # Draw the bar
        draw.rectangle([x1, y1, x2, y2], outline=colors["black"], fill=None, width=1)

        # Draw cost underneath each bar if available
        if costs and i < len(costs):
            cost_val = costs[i]
            # Truncate to integer (floor) and show without currency suffix
            try:
                label = str(int(cost_val))
            except Exception:
                label = ""
        else:
            label = ""
        draw.text((x1 + (bar_width / 2) - 6, y2 + 5), label, font=text_font, fill=colors["dark_gray"])  # adjusted shift for shorter text


def draw_electricity_price(draw, pos):
    prices, entries, highlight_index, level_label, consumption_values, consumption_costs, error_code = get_electricity_price_data()

    title = "Elpris"
    if level_label:
        if 0 <= highlight_index < len(prices):
            title = f"Elpris ({level_label} {prices[highlight_index]} öre)"
        else:
            title = f"Elpris ({level_label})"
    draw.text((pos[0], pos[1]), title, font=text_font, fill=colors["black"])

    # Price chart
    price_chart_width = 240
    price_chart_height = 100
    price_chart_pos = (pos[0], pos[1] + 30)

    draw_price_chart(draw, price_chart_pos, price_chart_width, price_chart_height, prices, highlight_index)

    # Error code (if any)
    if error_code is not None:
        error_text = f"Fel: {error_code}"
        draw.text((price_chart_pos[0], price_chart_pos[1] + price_chart_height + 5), error_text, font=text_font, fill=colors["black"])

    # Consumption chart
    consumption_chart_width = 240
    consumption_chart_height = 80
    gap = 40
    extra_offset = 20 if error_code is not None else 0
    consumption_chart_pos = (pos[0], pos[1] + 30 + price_chart_height + gap + extra_offset)

    draw_consumption_chart(draw, consumption_chart_pos, consumption_chart_width, consumption_chart_height, consumption_values, consumption_costs)
