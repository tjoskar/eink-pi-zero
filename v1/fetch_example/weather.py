from lib.gui_constant import (
  colors,
  icon_size,
  icon_font,
  text_font,
  big_icon_font,
  big_icon_size,
  headline_text_font,
  headline_text_size,
  text_size,
)
from fetch_example.weather_api import get_weather_display_data

def draw_weather(draw, pos):
  """Render current conditions + 5-day forecast anchored at `pos` (x, y)."""
  data = get_weather_display_data()
  current = data["current"]
  forecast = data["forecast"]

  # Primary current icon + temperature
  draw.text((pos[0], pos[1] + 16), current["icon"], font=big_icon_font, fill=colors["black"])
  draw.text(
    (pos[0] + big_icon_size + 16, pos[1] + 16 + (big_icon_size - headline_text_size) / 2),
    current["temp"],
    font=headline_text_font,
    fill=colors["black"],
  )

  detail_pos = (pos[0] + big_icon_size + headline_text_size + 64, pos[1] + 8)

  # Detail rows: wind, sun times, rain, UV
  rows = [
    ("\uefd8", current["wind_speed"]),
    ("\ue1c6", current["sun_times"]),
    ("\ue798", current["rain"]),
    ("\ue81a", current["uv_info"]),
  ]
  for i, (glyph, text) in enumerate(rows):
    y = detail_pos[1] + i * icon_size
    draw.text((detail_pos[0], y), glyph, font=icon_font, fill=colors["black"])
    draw.text(
      (detail_pos[0] + icon_size + 8, y + (icon_size - text_size) / 2),
      text,
      font=text_font,
      fill=colors["black"],
    )

  forecast_pos_y = pos[1] + big_icon_size + 16 * 3
  current_x = pos[0]
  for item in forecast:
    temp_width = get_text_width(draw, item["temp"], text_font)
    day_width = get_text_width(draw, item["day"], text_font)
    day_x = current_x + (temp_width - day_width) / 2
    draw.text((day_x, forecast_pos_y), item["day"], font=text_font, fill=colors["black"])
    icon_x = current_x + (temp_width - icon_size) / 2
    draw.text((icon_x, forecast_pos_y + text_size + 8), item["icon"], font=icon_font, fill=colors["black"])
    draw.text(
      (current_x, forecast_pos_y + text_size + 8 + icon_size + 8),
      item["temp"],
      font=text_font,
      fill=colors["black"],
    )
    current_x += max(temp_width, icon_size, day_width) + 16


def get_text_width(draw, text, font):
  bbox = draw.textbbox((0, 0), text, font=font)
  return bbox[2] - bbox[0]
