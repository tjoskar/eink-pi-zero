# Home Control Panel (E-Ink)

Read this post for more details: https://tjoskar.dev/posts/2025-04-25-eink-pi/

A dashboard for displaying various information on an E-Ink display, designed for
a Raspberry Pi Zero W.

## Getting started

Create and activate a Python virtual environment (recommended) and install
dependencies:

```
python3 -m venv venv # once
source venv/bin/activate
pip install -r requirements.txt
```

On subsequent shells, just reactivate with:

```
source venv/bin/activate
```

Then generate the image once to verify everything works:

```
python to-image.py
```

## Icons

Material icons can be found here: https://fonts.google.com/icons

## Development

Run the following command to automatically rebuild the image when code changes:

```
\ls *.py | entr -r python to-image.py
```

### MQTT Debugging

Use `mqtt_debug.py` to inspect MQTT traffic. It highlights device topics defined
in `config.py`.

```
python mqtt_debug.py
```

## Running on eink display

### Setup

```
mkdir ~/control-panel
cd ~/control-panel
python3 -m venv venv
source venv/bin/activate
pip install --system-site-packages -r requirements.txt
```

Create a systemd file:

```
sudo nano /etc/systemd/system/eink-display.service
```

```
[Unit]
Description=Control Panel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=<your user>
WorkingDirectory=/home/<your user>/control-panel

# Run Python from your virtual environment
ExecStart=/home/<your user>/control-panel/venv/bin/python /home/<your user>/control-panel/run_display.py

Restart=always
RestartSec=30

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```
sudo systemctl daemon-reload
sudo systemctl enable eink-display.service
sudo systemctl start eink-display.service
```

Check the logs:

```
sudo systemctl status eink-display.service
sudo journalctl -u eink-display.service -f
```

### Deployment

```
# Replace the host and user
rsync -av --exclude-from='.rsyncignore' . tjoskar@nasse:/home/tjoskar/control-panel
sudo systemctl restart control-panel.service
```
