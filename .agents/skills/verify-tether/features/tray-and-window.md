# Tray and window

The monitor lives in the tray. On Linux and Windows the icon shows a heart and the battery health as digits, green from 80, amber from 60, and red below, in a wide icon on Linux and a square one on Windows, and falls back to the battery mark when there is no health reading. On macOS the health sits beside the mark as its title. The tooltip reads the product name, the latest reading, and the health. The menu leads with two disabled lines, the latest reading such as `12% · Not charging`, `Battery unavailable`, or `Checking the battery` before the first read, and the health such as `87% health` or `Health unavailable`, then `Open Tether Preview` and `Quit`. Closing the window destroys it and keeps the monitor running. Opening it again from the tray builds a fresh window. A second launch raises the running instance's window instead of starting another.

## Sub-features

- The health icon and tooltip, updated after every check.
- The reading and health lines, updated after every check.
- Open, which recreates a closed window.
- Quit, which ends the process.
- The single-instance lock.

## How to get to it (user POV)

Click the tray icon, or open its menu.

## Driving it with the harness

Xvfb has no tray host, but the preview registers its menu on the real session bus:

```sh
$S/battery.sh Discharging 33 && sleep 3 && $S/tray.sh layout && $S/tray.sh icon "$EVIDENCE" tray-87
node $S/drive.ts close
$S/battery.sh Charging 34 100 && sleep 3 && $S/tray.sh layout && $S/tray.sh icon "$EVIDENCE" tray-100
$S/battery.sh Charging 34 none && sleep 3 && $S/tray.sh icon "$EVIDENCE" tray-no-health
$S/battery.sh Discharging unknown 64 && sleep 3 && $S/tray.sh icon "$EVIDENCE" tray-unavailable && $S/collect.sh "$EVIDENCE"
$S/tray.sh click "Open Tether Preview" && node $S/drive.ts snapshot | head -3
$S/tray.sh click Quit; sleep 2; $S/doctor.sh
```

Proof: the layout's first two lines, the saved icon, and the tooltip follow the fake battery, including while the window is closed, and the icon is the plain mark once the battery reports no health or is unreadable; the snapshot after Open shows a fresh window; doctor reports the preview process missing after Quit.

## Gotchas

- The menu exists only if a StatusNotifierWatcher was on the session bus when the preview launched, such as KDE Plasma's panel or GNOME with the AppIndicator extension. Doctor warns when it is missing. Relaunch the preview after the tray host comes back.
- `tray.sh` addresses `org.freedesktop.StatusNotifierItem-<pid>-1`, so run it only while the harness preview is up.
- `tray.sh icon` saves the image the app hands the tray host, not how the panel scales it. The icon on a real panel, the macOS title, and a left click need eyes on a real desktop. Record them in `notes.md` if they matter to the change.
- After Quit, run `cleanup.sh` before the next launch.
