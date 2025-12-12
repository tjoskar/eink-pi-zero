from gpiozero import LED, Button
from signal import pause

# Define which GPIO pins we are using (use BCM numbering, read more about this above)
LED_PIN = 13 # Connect the resistor/LED to GPIO 13
BUTTON_PIN = 21 # Connect the button to GPIO 21

led = LED(LED_PIN)
button = Button(BUTTON_PIN, pull_up=True, bounce_time=0.05)

def on_press():
  led.on()

def on_release():
  led.off()

button.when_pressed = on_press
button.when_released = on_release

pause()
