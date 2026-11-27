# Home Dashboard

The author's own home display: weather, device status and household readings on a Waveshare 7.5" V2 panel driven by a Raspberry Pi Zero 2 W. It is a real consumer of the Framework, not teaching material; build your own rather than copying it as-is.

## Wiring

All pins are BCM GPIO numbers, with the physical header pin in brackets. Verified on the hardware.

| Part                   | GPIO   | Physical pin                                                                 | Notes                                                                                                                        |
| ---------------------- | ------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Engine-heater button   | GPIO21 | 40 (GND on 39)                                                               | Active low, internal pull-up, 50 ms debounce                                                                                 |
| Engine-heater LED      | GPIO13 | 33 (GND on 34)                                                               |                                                                                                                              |
| Second button (unused) | GPIO20 | 38 (GND shared with the engine-heater button, pin 39; not visually verified) | Active low, internal pull-up, needs 50 ms debounce (bounces heavily without it). Wired and working, but no code reads it yet |

The e-paper HAT uses physical pins 1, 6, 11, 12, 18, 19, 22, 23 and 24 (3V3, GND, RST GPIO17, PWR GPIO18, BUSY GPIO24, MOSI, DC GPIO25, SCLK, CS).

## Pi setup

Once per Pi (64-bit Raspberry Pi OS), before the first `pnpm pi:deploy dashboard <user@host>`:

```bash
# Node 26 from NodeSource
curl -fsSL https://deb.nodesource.com/setup_26.x | sudo bash -
sudo apt install -y nodejs

# SPI for the panel
sudo raspi-config nonint do_spi 0

# Access to the GPIO and SPI devices (gpiod is only for debugging: gpioinfo)
sudo apt install -y gpiod
sudo usermod -aG gpio,spi "$USER"

# Start the user unit at boot without a login
sudo loginctl enable-linger "$USER"

# For SPI and the new groups
sudo reboot
```

Moving from the old system unit (`eink-panel`, deployed to `~/eink-panel/`)? Remove it first, so it never drives the panel at the same time as the new one:

```bash
sudo systemctl disable --now eink-panel
sudo rm /etc/systemd/system/eink-panel.service /etc/logrotate.d/eink-panel
sudo systemctl daemon-reload
rm -rf ~/eink-panel
```

Settings go in `dashboard/.env.pi` on your computer (copy `.env.example`). Logs: `journalctl --user-unit eink-dashboard -f`.
