# Changelog

All notable changes to `@tjoskar/eink` are documented here. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the package uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `<text>` without an explicit `width` is now as wide as its text (measured with the same font as it is drawn), so several texts in a row lay out side by side instead of collapsing to 0 px. An explicit `width` still wins. Single line only; height is unchanged.
- Text wider than its box is shortened with a trailing `…` instead of drawing outside the box.
- A warning is logged once per font family that is used but not registered.

### Changed

- The `fetch-example-openweather` Example drops its hard-coded text widths; its snapshot is updated (the big temperature no longer overflows its box, forecast columns grow to fit their text).
