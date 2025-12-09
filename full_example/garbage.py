from PIL import Image, ImageDraw, ImageFont
from lib.gui_constant import colors, icon_size, icon_font, text_font, text_size
from datetime import datetime, timedelta

# This could later be fetched from an external source
# Each tuple contains (household waste date, garden waste date)
# Both dates are in the same week, Wednesday and Friday
garbage_collection_dates = [
    {"household": "2025-10-29", "garden": "2025-10-31"},
    {"household": "2025-11-12", "garden": "2025-11-14"},
    {"household": "2025-11-26", "garden": "2025-11-28"},
    {"household": "2025-12-10"},
    {"household": "2025-12-24"},
    {"household": "2026-01-07"},
    {"household": "2026-01-21"},
]

def get_next_collection(today_str):
    """Return next up to two collection events (household/garden) from today.

    Garden events are optional; skip gracefully if missing.
    """
    today = datetime.strptime(today_str, "%Y-%m-%d").date()

    future_dates = []
    for collection in garbage_collection_dates:
        # Parse household date
        try:
            household_date = datetime.strptime(collection["household"], "%Y-%m-%d").date()
        except Exception:
            continue  # Skip malformed entry
        if household_date >= today:
            future_dates.append({"type": "household", "date": household_date})

        # Garden is optional
        garden_raw = collection.get("garden")
        if garden_raw:
            try:
                garden_date = datetime.strptime(garden_raw, "%Y-%m-%d").date()
                if garden_date >= today:
                    future_dates.append({"type": "garden", "date": garden_date})
            except Exception:
                pass  # Ignore malformed garden date

    return future_dates[:2]

def get_days_until(target_date, today_str):
    """Calculate days until the target date from today."""
    today = datetime.strptime(today_str, "%Y-%m-%d").date()
    days = (target_date - today).days

    if days == 0:
        return "idag"
    elif days == 1:
        return "imorgon"
    else:
        return f"om {days} dagar"

def get_reminder_message(collection, today_str):
    """Generate a reminder message in Swedish based on collection type and date."""
    days_until = get_days_until(collection["date"], today_str)
    date_str = collection["date"].strftime("%d/%m")

    if collection["type"] == "household":
        return f"Hushållssopor: {date_str} ({days_until})"
    else:
        return f"Trädgårdsavfall: {date_str} ({days_until})"

def draw_garbage_collection(draw, pos):
    # Determine today's date string (UTC local naive)
    today_str = datetime.now().strftime("%Y-%m-%d")
    next_collections = get_next_collection(today_str)

    # Calculate positions and spacing
    title_height = text_size + 12
    line_height = text_size + 8
    start_y = pos[1] + title_height

    # Draw reminders for the next collections
    for i, collection in enumerate(next_collections):
        reminder_y = start_y + line_height * i  # Adjusted to start immediately after title
        reminder_text = get_reminder_message(collection, today_str)
        draw.text((pos[0], reminder_y), reminder_text, font=text_font, fill=colors["black"])

    # Add a general instruction if next collection is soon (within 2 days)
    if next_collections and get_days_until(next_collections[0]["date"], today_str) in ["idag", "imorgon"]:
        instruction_y = start_y + line_height * len(next_collections)  # Adjusted to follow the collection items directly
        type_text = "Hushållssoporna" if next_collections[0]["type"] == "household" else "Trädgårdsavfallet"
        draw.text((pos[0], instruction_y), f"Dags att ställa ut {type_text.lower()}!",
                font=text_font, fill=colors["black"])
