# Changelog

All notable changes to `@tjoskar/eink` are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `<text>` without an explicit `width` is now as wide as its text (measured with the same font as it is drawn), so several texts in a row lay out side by side instead of collapsing to 0 px. An explicit `width` still wins. Single line only; height is unchanged.
- Text wider than its box is shortened with a trailing `…` instead of drawing outside the box. Its box only gets narrower than the text with an explicit `width`/`maxWidth`, by stretching, or with `flexShrink` (which defaults to 0), so long texts in a too-narrow row still overflow.
- A warning is logged once per font family that is used but not registered.
- `renderToDisplay(png, { mode: "gray4" })`: a 4-gray full refresh (every pixel to its nearest of four levels; no dithering yet).
- A refresh guard: at least 2 s from the end of one render to the start of the next, at most 3 renders a minute and 20 an hour. A render that comes too soon waits, and only the latest waiting frame is drawn. Reaching the hourly limit is treated as a render loop: the process cleans up and exits with `REFRESH_LOOP_EXIT_CODE` (75). The limits can be changed with `initHardware({ refreshLimits })`.
- Icon names `sunny`, `weather_snowy`, `laundry`, `flatware`, `print` and `directions_car`.
- `dist/cleanup.js [led-pin...]`, for a systemd unit's `ExecStopPost=`: drives the panel's power, RST, DC and the given LEDs low after a crash or SIGKILL.

### Changed

- **Breaking:** the panel, button and LED are driven from Node (GPIO and SPI ioctls through Koffi) instead of a Python daemon. The Pi no longer needs `python3-pil`, `python3-spidev` or `python3-gpiozero`; the user must be in the `gpio` and `spi` groups.
- **Breaking:** the handle from `initHardware()` is async: use `await using`, and `cleanup()` returns a promise. It waits for a running render to finish its current step and put the panel into deep sleep.
- `initHardware()` fails with "GPIO lines busy: another app owns the panel" if another process holds the panel's lines, and cleans up on SIGINT, SIGTERM and SIGHUP by itself.
- LED and button pins can be any GPIO except the panel's and SPI's.
- Images must be 800x480; the Python daemon also rotated 480x800 images.

- The `fetch-example-openweather` Example drops its hard-coded text widths; its snapshot is updated (the big temperature no longer overflows its box, forecast columns grow to fit their text).

### Fixed

- **Breaking (visual):** 12 icon names drew another glyph than their name: `thermostat`, `wb_iridescent`, `air`, `umbrella`, `thunderstorm`, `severe_cold`, `blur_on`, `wind_power`, `light`, `local_laundry_service`, `dry_cleaning` and `local_fire_department`. They now draw their own glyph; to keep the old look, use the name of the glyph it drew (e.g. `severe_cold` drew `weather_snowy`, `wind_power` drew `air`, `wb_iridescent` drew `sunny`, `local_fire_department` drew `directions_car`). A test checks every name against the font.
