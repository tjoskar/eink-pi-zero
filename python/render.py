#!/usr/bin/env python3
"""
Minimal e-ink renderer for Waveshare 7.5" V2 display.

This script is designed to be called from Node.js via spawn().
It takes a PNG image path and renders it to the e-ink display.

Usage:
    python3 render.py <image.png>              # Normal render
    python3 render.py <image.png> --fast       # Fast render (init_fast)
    python3 render.py <image.png> --clear      # Clear display before render

Dependencies (install via apt, not pip):
    sudo apt install python3-pil python3-spidev python3-gpiozero

Exit codes:
    0 = Success
    1 = Error (message on stderr)
"""

import sys
import argparse
from PIL import Image

# Import the Waveshare driver (same directory)
from epd7in5_v2 import EPD


def main():
    parser = argparse.ArgumentParser(description="Render PNG to e-ink display")
    parser.add_argument("image", help="Path to PNG image (800x480)")
    parser.add_argument("--fast", action="store_true", help="Use fast init mode")
    parser.add_argument("--clear", action="store_true", help="Clear display before render")
    args = parser.parse_args()

    try:
        # Load and validate image
        image = Image.open(args.image)

        # Resize if needed (should already be 800x480 from TypeScript)
        if image.size != (800, 480):
            print(f"[render.py] Resizing from {image.size} to (800, 480)", file=sys.stderr)
            image = image.resize((800, 480), Image.Resampling.LANCZOS)

        # Initialize display
        epd = EPD()

        if args.fast:
            epd.init_fast()
            print("[render.py] Initialized (fast mode)")
        else:
            epd.init()
            print("[render.py] Initialized (normal mode)")

        # Clear if requested
        if args.clear:
            epd.Clear()
            print("[render.py] Display cleared")

        # Render image
        epd.display(epd.getbuffer(image))
        print(f"[render.py] Displayed: {args.image}")

        # Enter sleep mode
        epd.sleep()
        print("[render.py] Sleeping")

        return 0

    except FileNotFoundError:
        print(f"Error: Image not found: {args.image}", file=sys.stderr)
        return 1
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
