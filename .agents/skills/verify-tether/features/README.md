# Tether feature map

One file per user-facing feature of the preview app.

- [low-battery-alerts](low-battery-alerts.md) - alerts while discharging at or below the low level
- [high-battery-alerts](high-battery-alerts.md) - alerts while charging at or above the high level
- [alert-sessions](alert-sessions.md) - the per-crossing alert limit and how settings changes reset it
- [sound-and-urgency](sound-and-urgency.md) - the chosen sound, the system sound, and Linux urgency
- [settings-window](settings-window.md) - validation, persistence across restarts, and open at login
- [tray-and-window](tray-and-window.md) - tray menu, closing to the tray, reopening, and quitting
- [updates](updates.md) - finding, offering, and refusing to install releases

Every proof runs on the built Tether Preview through the helpers in `scripts/`, with the fake battery unless the file says otherwise.
