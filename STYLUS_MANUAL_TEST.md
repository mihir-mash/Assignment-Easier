# Stylus manual test

Run this checklist on the touchscreen laptop with the real pen. These checks are pending; automated pointer simulation does not verify hardware behavior.

- [ ] Create a handwriting profile and begin a prompt.
- [ ] Pen draws smoothly; hovering does not draw.
- [ ] With **Pen only** on, resting a palm on the display does not create strokes; mouse input remains available for testing.
- [ ] With **Pen only** off, touch input can draw.
- [ ] Pressure is recorded if the device/browser reports it; absent pressure does not stop capture.
- [ ] Tilt is recorded if the device/browser reports it; absent tilt does not stop capture.
- [ ] The page does not scroll or zoom while writing on the canvas.
- [ ] Resize the window after drawing; the visible drawing and stored sample remain intact.
- [ ] Refresh during an unfinished stroke; the draft recovers paused and the interrupted stroke is retained.
- [ ] Undo removes the last stroke.
- [ ] Clear removes only the current sample; previously saved samples remain.
- [ ] Save, repeat, pause, resume and finish preserve separate samples and prompt progress.
