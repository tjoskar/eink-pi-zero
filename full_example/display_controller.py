"""DisplayController: encapsulates E-Ink rendering (full render + debounced scheduling + dialogs).

Keep lean for Pi Zero W; EPD driver instance injected for easier testing/mocking.
"""

import threading
import time
from dialog import build_dialog_image
from config.settings import MQTT_RENDER_DEBOUNCE_SECONDS
from compose import compose_panel

class DisplayController:

    def __init__(self, epd):
        """Bind controller to provided EPD instance (can be a mock)."""
        # Core hardware driver (Waveshare EPD instance) provided by caller
        self._epd = epd
        # Mutex guarding any interaction with the panel (full + partial renders)
        self._render_lock = threading.Lock()
        # Event used to signal shutdown to background timers
        self._stop_event = threading.Event()
        # Debounce timer reference for scheduled full renders (MQTT bursts)
        self._render_timer = None
        # Counter of all display operations (full + partial + dialog show/restore)
        # Used to decide when to do a full clear or force full render to mitigate ghosting.
        self._render_count = 0
        # Active timer for restoring dialog region; presence means a dialog is currently visible.
        self._dialog_restore_timer = None
        print("[DISPLAY] Controller constructed")

    def stop(self):
        self._stop_event.set()
        try:
            if self._render_timer is not None:
                self._render_timer.cancel()
        except Exception:
            pass
        print("[DISPLAY] Controller stopped")

    # ---- Rendering ----
    def render(self):
        """Full panel render (slow init + optional clear)."""
        with self._render_lock:
            # Every 10th render: do a clear after init to reduce ghosting
            self._epd.init()
            do_clear = False
            do_clear = (self._render_count % 10 == 0)
            if do_clear:
                self._epd.Clear()
            t0 = time.perf_counter()
            img = compose_panel()
            dt_ms = (time.perf_counter() - t0) * 1000
            self._epd.display(self._epd.getbuffer(img))
            self._epd.sleep()
            # keep a copy for potential partial overlays (dialogs, etc.)
            self._last_image = img.copy()
            self._render_count += 1
            print(f"[RENDER] Full update done (count={self._render_count}, clear={do_clear}, compose={dt_ms:.1f}ms)")

    def fast_render(self):
        """Full panel render using fast init (no clear)."""
        with self._render_lock:
            self._epd.init_fast()
            t0 = time.perf_counter()
            img = compose_panel()
            dt_ms = (time.perf_counter() - t0) * 1000
            self._epd.display(self._epd.getbuffer(img))
            self._epd.sleep()
            # keep a copy for potential partial overlays (dialogs, etc.)
            self._last_image = img.copy()
            self._render_count += 1
            print(f"[RENDER-FAST] Full update done (count={self._render_count}, compose={dt_ms:.1f}ms)")

    def schedule_render(self):
        """Debounced full render (cancels previous timer)."""
        if self._render_timer is not None:
            self._render_timer.cancel()

        def _do():
            self.render()

        self._render_timer = threading.Timer(MQTT_RENDER_DEBOUNCE_SECONDS, _do)
        self._render_timer.daemon = True
        self._render_timer.start()
        print(f"[DEBOUNCE] Display render scheduled in {MQTT_RENDER_DEBOUNCE_SECONDS}s")

    # ---- Helpers ----
    @property
    def stopped(self) -> bool:
        return self._stop_event.is_set()

    # ---- Dialog / Modal ----
    def show_dialog(self, text: str, duration: float = 5.0):
        DIALOG_W, DIALOG_H = 400, 200
        padding = 20

        with self._render_lock:
            # Ignore new dialog if one is already visible
            if self._dialog_restore_timer is not None:
                print("[DIALOG] Active dialog present; ignoring new request")
                return

            # Center position
            x1 = (self._epd.width - DIALOG_W) // 2
            y1 = (self._epd.height - DIALOG_H) // 2
            x2 = x1 + DIALOG_W
            y2 = y1 + DIALOG_H
            bbox = (x1, y1, x2, y2)

            # Build dialog image via helper for reuse
            dialog_img = build_dialog_image(text, width=DIALOG_W, height=DIALOG_H, padding=padding, shadow=True, shadow_offset=8)

            base = compose_panel()
            base.paste(dialog_img, (x1, y1))

            self._epd.init_fast()
            self._epd.display(self._epd.getbuffer(base))
            self._epd.sleep()
            print(f"[DIALOG] Shown at bbox={bbox} for {duration}s (count={self._render_count})")

            # Schedule restore
            def _restore():
                self._dialog_restore_timer = None
                if self._stop_event.is_set():
                    return
                self.fast_render()

            self._dialog_restore_timer = threading.Timer(duration, _restore)
            self._dialog_restore_timer.daemon = True
            self._dialog_restore_timer.start()
