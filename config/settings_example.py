# --- MQTT configuration ---
MQTT_HOST = "homeassistant.local"  # Replace with your Home Assistant / broker host
MQTT_PORT = 1883          # Standard MQTT port
MQTT_USERNAME = ""      # Set to your broker username or keep None for anonymous
MQTT_PASSWORD = ""      # Set to your broker password or keep None
MQTT_TOPIC_PREFIX = "statechange"  # Subscribe filter prefix; set to None to disable filtering in debug script
MQTT_RENDER_DEBOUNCE_SECONDS = 3    # Delay batching of rapid retained messages before rendering


# OpenWeatherMap API configuration
WEATHER_API_KEY = ""  # Replace with your actual API key
WEATHER_LAT = 59.3293  # Stockholm coordinates (replace with your location)
WEATHER_LON = 18.0686
WEATHER_UNITS = "metric"  # Options: standard, metric, imperial
WEATHER_LANG = "sv"  # Swedish language for weather descriptions

# Tibber API configuration (GraphQL)
# Set your personal access token here. Keep private and do not print.
TIBBER_TOKEN = ""  # Replace with your Tibber API token

# API request configuration
API_TIMEOUT = 10  # Timeout for API requests in seconds
CACHE_DURATION = 3600  # Cache duration in seconds (1 hour)

# Dashboard refresh interval (seconds) for periodic full redraw
# Used by run_dev.py and run_display.py background threads
REFRESH_INTERVAL = 3600

# Menu / dishes source configuration
DISHES_API_URL = ""  # Weekly dishes JSON endpoint


# All devices defined here for single source of truth.
# Each device has: label (Swedish), topic (MQTT), icon (glyph), on (initial state)
DEVICES_CONFIG = [
	{"label": "Tvättmaskin", "topic": "statechange/washing_machine", "icon": "\ue832", "on": False},
	{"label": "Torktumlare", "topic": "statechange/dryer", "icon": "\ue54a", "on": False},
	{"label": "Motorvärmare", "topic": "statechange/motorvarmare", "icon": "\ue531", "on": False},
	{"label": "Cykelladdare", "topic": "statechange/bike_charger", "icon": "\ueb1b", "on": False},
]

# Derived list of topics for subscription convenience
MQTT_DEVICE_TOPICS = [d["topic"] for d in DEVICES_CONFIG]
