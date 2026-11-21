# E-Ink Pi Zero

A TSX framework for rendering e-ink displays on a Raspberry Pi, the examples that teach it, and the author's own home display built on it.

## Language

**Framework**:
The reusable, public rendering and hardware layer that apps are built on.
_Avoid_: lib, library, engine

**Render mode**:
How an app's image reaches the panel: black and white only (mono), or four grey levels (4-gray, sharper but only on newer panels). Every app chooses one explicitly.
_Avoid_: color mode, depth

**Example**:
A small, self-contained app that teaches one Framework concept; referenced by the book.
_Avoid_: demo, sample, book code

**Dashboard**:
The author's own home display app, a real consumer of the Framework rather than teaching material.
_Avoid_: home-dashboard, panel, my screen

**Device**:
A household appliance whose state the Dashboard shows as a symbol (e.g. dryer, engine heater).
_Avoid_: entity, sensor

**End time**:
The clock time at which a running Device is expected to finish, shown instead of a countdown.
_Avoid_: remaining time, ETA

**Request**:
A press on the Dashboard's button asking Home Assistant to switch a Device on or off; a request alone changes nothing.
_Avoid_: command, toggle

**Confirmed state**:
The on/off state of a Device as Home Assistant reports it; the only state the Dashboard treats as true.
_Avoid_: local state, real state

**Pending**:
The short window after a Request in which the Dashboard optimistically shows the requested state while waiting for a Confirmed state; it ends in confirmation or a revert.
_Avoid_: loading, optimistic state

**Auto-off**:
Home Assistant switching the engine heater off on its own, after a maximum on-time or once it stops drawing power.
_Avoid_: timer, shutoff

**Reading**:
A measured value (temperature, humidity, heat-pump health) the Dashboard shows but never re-renders for; it appears at the next scheduled render.
_Avoid_: sensor, value

**Forecast**:
The predicted weather, now and for the coming days, from a weather service; unlike a Reading it is not measured at the house.
_Avoid_: weather data, prediction

**Offline mark**:
The footer mark telling the viewer the shown data may be old because Home Assistant or the broker cannot be reached.
_Avoid_: error, stale indicator

**Short-cycling warning**:
The heat-pump line turning black with a warning icon when the compressor has started more than a set number of times in 24 h, the known hot-water fault.
_Avoid_: alarm, error
