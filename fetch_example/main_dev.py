import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent)) # Adds the current path to sys.path to import config.settings
from PIL import Image, ImageDraw
from weather import draw_weather

WIDTH, HEIGHT = 800, 480
PADDING = 16

def compose_panel():
    image = Image.new("L", (WIDTH, HEIGHT), 255)
    draw = ImageDraw.Draw(image)

    draw_weather(draw, (PADDING, PADDING))
    return image

if __name__ == "__main__":
    panel_image = compose_panel()
    panel_image.save("weather.png")
