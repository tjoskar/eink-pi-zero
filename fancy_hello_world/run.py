import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent)) # Adds the current path to sys.path to import the driver in the parent dir

from driver.epd7in5_v2 import EPD  # Import the EPD class for the 7.5" v2 e-paper display
from PIL import Image, ImageDraw, ImageFont  # Import Pillow modules for image creation and drawing

# Add some print statements to trace execution for potential debugging
print(1)
epd = EPD()  # Create a helper instance of the EPD class to communicate with the screen
print(2)
epd.init_4Gray()  # Initialize the screen and prepare it for use; this is the first communication with the screen
print(3)
epd.Clear()  # Clear everything on the screen; useful to remove any remnants from previous updates
print(4)

# Create a new image with white background
image = Image.new('L', (epd.width, epd.height), 255)
draw = ImageDraw.Draw(image)

# Load the custom font
fonts_dir = Path(__file__).resolve().parent.parent / 'fonts'
font = ImageFont.truetype(str(fonts_dir / 'titan-one-regular.ttf'), 42)

# Load and process the image
borat_path = Path(__file__).resolve().parent / 'borat.jpeg'
borat_img = Image.open(borat_path).convert('L') # Convert to grayscale for e-ink

# Calculate dimensions for centering
text = "Very Nice!"
# Get text bounding box (left, top, right, bottom)
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_height = bbox[3] - bbox[1]

img_width, img_height = borat_img.size
spacing = 20
total_height = text_height + spacing + img_height

# Calculate starting Y position to center vertically
current_y = (epd.height - total_height) // 2

# Draw text centered horizontally
text_x = (epd.width - text_width) // 2
draw.text((text_x, current_y), text, font=font, fill=0)

# Draw image centered horizontally below text
img_x = (epd.width - img_width) // 2
image.paste(borat_img, (img_x, current_y + text_height + spacing))

print(5)

epd.display_4Gray(epd.getbuffer_4Gray(image))  # Convert the image to a display buffer and send it to the screen

print(6)

# Put the screen into sleep mode to save power when not in use. This is
# important: the screen can be damaged if it remains powered for a long time
# without updates. In a real application, you would call sleep in a finally
# block to ensure the screen always enters sleep even if the program crashes.
epd.sleep()

print(7)
