# E-ink Dashboard Example Code

This repository contains example code accompanying an e-book on how to build a dashboard using an e-ink display and a Raspberry Pi Zero.

## Contents

The code is organized into different folders demonstrating various features and steps in the process:

- **hello_world/**: A simple starting point to verify the display works and show text.
- **fancy_hello_world/**: A slightly more advanced "Hello World" example with more formatting.
- **button_and_led/**: Examples of interacting with hardware, such as buttons and LEDs.
- **fetch_example/**: Shows how to fetch data from external APIs (e.g., weather data).
- **mqtt_example/**: Examples of communication and data transfer via MQTT.
- **full_example/**: A complete example of a dashboard combining multiple data sources (menu, electricity prices, garbage collection, weather) into a finished application.

## Installation

To install the necessary dependencies:

**For local development (on your computer):**
```bash
pip install -r requirements_local.txt
```

**For Raspberry Pi:**
```bash
pip install -r requirements_pi.txt
```

## Configuration

See the `config/` folder for settings. You may need to copy `settings_example.py` to `settings.py` and adjust the variables to your environment.
