from PIL import ImageFont

colors = {
    "black": 0,
    "dark_gray": 85,
    "light_gray": 170,
    "white": 255,
}

# Fonts
icon_size = 36
big_icon_size = icon_size * 3
text_size = 16
headline_text_size = 64
icon_font = ImageFont.truetype("../fonts/material-icons.woff", icon_size)
big_icon_font = ImageFont.truetype("../fonts/material-icons.woff", big_icon_size)
text_font = ImageFont.truetype("../fonts/noto-sans-regular.ttf", text_size)
headline_text_font = ImageFont.truetype("../fonts/noto-sans-regular.ttf", headline_text_size)
