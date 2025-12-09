import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent)) # Adds the current path to sys.path to import the driver in the parent dir

from driver.epd7in5_v2 import EPD  # Import the EPD class for the 7.5" v2 e-paper display
from PIL import Image, ImageDraw, ImageFont  # Import Pillow modules for image creation and drawing

# Add some print statements to trace execution for potential debugging
print(1)
epd = EPD()  # Create a helper instance of the EPD class to communicate with the screen
print(2)
epd.init()  # Initialize the screen and prepare it for use; this is the first communication with the screen
print(3)
epd.Clear()  # Clear everything on the screen; useful to remove any remnants from previous updates
print(4)

# This creates an image with the same dimensions as the screen. We can use '1'
# for a 1-bit image, meaning the screen shows black or white only. We set the
# fill color to 255 (white). Alternatively, we can use 'L' instead of '1' to
# create an 8-bit grayscale image. That lets us render grayscale instead of only
# black and white. Besides '1' and 'L', there is also 'P' for palettized color
# and 'RGB' for color images. For simplicity, we use '1' here for this hello
# world example.
image = Image.new('1', (epd.width, epd.height), 255)
draw = ImageDraw.Draw(image)  # Create a drawing context for the image so we can add shapes and text to it
font = ImageFont.load_default()  # Load the default bitmap font
draw.text((100, 100), "Hello World", font=font, fill=0)  # Draw black (fill=0) text at position (x=100, y=100)

print(5)

epd.display(epd.getbuffer(image))  # Convert the image to a display buffer and send it to the screen

print(6)

# Put the screen into sleep mode to save power when not in use. This is
# important: the screen can be damaged if it remains powered for a long time
# without updates. In a real application, you would call sleep in a finally
# block to ensure the screen always enters sleep even if the program crashes.
epd.sleep()

print(7)
