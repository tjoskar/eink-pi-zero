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
