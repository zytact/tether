# Tray and window

The monitor lives in the tray. Its menu leads with a disabled line for the latest reading, such as `12% · Not charging`, `Battery unavailable`, or `Checking the battery` before the first read, then `Open Tether Preview` and `Quit`. Closing the window destroys it and keeps the monitor running. Opening it again from the tray builds a fresh window. A second launch raises the running instance's window instead of starting another.

## Sub-features

- The reading line, updated after every check.
- Open, which recreates a closed window.
- Quit, which ends the process.
- The single-instance lock.

## How to get to it (user POV)

Click the tray icon, or open its menu.

## Driving it with the harness

Xvfb has no tray host, but the preview registers its menu on the real session bus:

```sh
$S/battery.sh Discharging 33 && sleep 3 && $S/tray.sh layout
node $S/drive.ts close
$S/battery.sh Charging 34 && sleep 3 && $S/tray.sh layout && $S/collect.sh "$EVIDENCE"
$S/tray.sh click "Open Tether Preview" && node $S/drive.ts snapshot | head -3
$S/tray.sh click Quit; sleep 2; $S/doctor.sh
```

Proof: the layout's first line follows the fake battery, including while the window is closed; the snapshot after Open shows a fresh window; doctor reports the preview process missing after Quit.

## Gotchas

- The menu exists only if a StatusNotifierWatcher was on the session bus when the preview launched, such as KDE Plasma's panel or GNOME with the AppIndicator extension. Doctor warns when it is missing. Relaunch the preview after the tray host comes back.
- `tray.sh` addresses `org.freedesktop.StatusNotifierItem-<pid>-1`, so run it only while the harness preview is up.
- The icon's look and a left click need eyes on a real desktop panel. Record them in `notes.md` if they matter to the change.
- After Quit, run `cleanup.sh` before the next launch.
