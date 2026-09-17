---
name: verify-tether
description: Build and drive the isolated Tether Preview Electron tray app against a fake battery, then capture proof of its notifications, urgency, sound, settings window, persistence, tray menu, and updates. Use when verifying a change to alert thresholds, alert sessions, settings changes, sound playback, open at login, the tray, or the updater.
---

# Verify Tether

Tether is an Electron tray app. The main process reads the battery on an interval, decides alerts in `src/main/alerts.ts`, sends notifications, and plays the chosen sound in a hidden window. The window is a settings page. Every change there saves to `settings.json` and applies to the running monitor at once. There is no CLI.

Verification uses the built preview app on Linux. Drive its real window over the Chrome DevTools Protocol, its tray menu over D-Bus, and its battery through a fake sysfs tree. Do not load `dist/index.html` or the dev server in a browser, and do not stub `window.tether`: a plain tab has no preload bridge and no monitor.

## Isolation

`src/main/identity.ts` gives the preview its own product name `Tether Preview`, app id `dev.arnab.tether.preview`, and executable `tether-preview`, so its settings, autostart entry, and single-instance lock never touch an installed release.

`launch.sh` adds three more layers:

- An Xvfb display, so the window never appears on the desktop.
- `XDG_CONFIG_HOME` under `/tmp/tether-verify/home/config`, so settings and the autostart entry land in scratch space.
- `TETHER_POWER_SUPPLY` pointing at a fake sysfs tree under `/tmp/tether-verify/power_supply`. Only preview builds read it. The tree also holds a 5% wireless-mouse battery with a `Device` scope, which the app must skip.

Two things are not isolated. The session D-Bus and the audio server are the real ones, so alerts pop up on the user's desktop, the sound is audible, and the preview's tray icon shows in the user's panel while it runs. That is what makes notifications, sound, and the tray observable. Keep runs short.

Only one harness preview runs at a time. `launch.sh` refuses a second launch until `cleanup.sh` runs. Never kill Tether processes by name: the user may run the release app.

## Launch

Run from the repository root. Needs `vp`, Xvfb, `xprop`, `dbus-monitor`, `pactl`, `gdbus`, `curl`, `python3`, and `ffmpeg` for a test sound.

```sh
S=.agents/skills/verify-tether/scripts
EVIDENCE=verification-evidence/tether-$(date -u +%Y%m%dT%H%M%SZ)-<name>
mkdir -p "$EVIDENCE"
ffmpeg -y -loglevel error -f lavfi -i "sine=frequency=880:duration=0.4" "$EVIDENCE/beep.wav"
$S/build-preview.sh 2>&1 | tail -1
$S/launch.sh --settings "{\"intervalSeconds\":2,\"notifyAttempts\":3,\"soundPath\":\"$PWD/$EVIDENCE/beep.wav\"}"
$S/doctor.sh
```

Ready means `launch.sh` prints `Ready: Tether Preview` and `doctor.sh` ends with `DOCTOR: worth driving`. The fake battery starts at `Discharging 50%`, which crosses no default threshold.

- `--settings JSON` seeds `settings.json` before the first launch. Use it for a short interval and a sound path, since the file chooser is a native dialog the harness cannot drive. Fields left out take their defaults.
- `--real-battery` skips the fake tree and reads the machine's battery. Use it once to confirm the fake tree is not lying.
- `--restart` quits and relaunches only the preview, keeping the display, recorders, battery, and saved settings. That is how a proof shows a setting survives a restart.

`build-preview.sh` runs `vp build`, `vp pack`, and `node scripts/package.ts --preview --dir`. Rebuild after every source change; doctor fails when `src` is newer than the binary.

## Doctor

```sh
$S/doctor.sh
```

Read-only. It checks the preview identity, that the binary is newer than `src`, that the recorded PID runs the built binary, the Xvfb display, the DevTools port, both recorders, that a notification server owns `org.freedesktop.Notifications`, and the battery mode. Run it before the first drive and whenever something looks off.

## Drive

Set the battery. The app reads it on its next check:

```sh
$S/battery.sh Discharging 12
$S/battery.sh Charging 90
```

Drive the window by ARIA role and accessible name, as `snapshot` prints them:

```sh
node $S/drive.ts snapshot
node $S/drive.ts fill "Low battery level" 15
node $S/drive.ts click switch "High battery alerts"
node $S/drive.ts select Urgency Critical
node $S/drive.ts screenshot "$EVIDENCE" settings
node $S/drive.ts close
```

The handles are: spinbuttons `High battery level`, `Low battery level`, `Alerts per crossing`, `Check every`; switches `High battery alerts`, `Low battery alerts`, `Open at login`; buttons `Choose` and `Clear` for the sound; combobox `Urgency`; buttons `Check for updates` and, while a release is on offer, `Install update`. The header paragraph reads the latest check, such as `12% · Not charging`. A rejected entry shows an `alert` with the reason and puts the saved value back. `fill` commits with Enter, which is how the window saves a number.

Read and click the tray menu:

```sh
$S/tray.sh layout
$S/tray.sh click "Open Tether Preview"
$S/tray.sh click Quit
```

`close` destroys the window and leaves the monitor in the tray. `drive.ts` then reports no window until the tray reopens it.

## Evidence

```sh
$S/collect.sh "$EVIDENCE"
```

Run it after each step worth proving; it reflects everything since launch. It writes into the evidence directory:

| File | What it proves |
| --- | --- |
| `summary.txt` | notification count by payload, audio streams, sound and battery errors |
| `notifications.txt` | one line per notification: app, summary, body, urgency byte (0 low, 1 normal, 2 critical) |
| `notifications.raw` | the `dbus-monitor` trace behind it |
| `audio-streams.txt` | `tether-preview` sink inputs, with first and last time seen |
| `battery-timeline.log` | every launch and battery change, with times |
| `preview.log` | the app's own errors, such as `Failed to play` or `Skipped the alert sound` |
| `settings.json` | what the app saved |

Add screenshots with `drive.ts screenshot` after each materially different window state, and a short `notes.md` naming what was covered and what could not be.

Proof standards:

- Drive the real user path: the window's fields and switches, the tray, and the battery the app reads. Do not call IPC channels directly or edit `settings.json` while the app runs. `--settings` is only for the starting state.
- Capture the transition. Collect before and after a change so the count moves, rather than showing one final number.
- Verify side effects alongside the window: `notifications.txt` for alerts, `audio-streams.txt` and `preview.log` for sound, `settings.json` for persistence.
- Chromium keeps one audio stream open across plays, so `audio-streams.txt` proves sound played but not how many times. A skipped or failed sound always logs in `preview.log`.
- `notifications.txt` counts only calls addressed to the notification server. The server forwards each one to the shell, and the parser drops those copies.

## Cleanup

```sh
$S/cleanup.sh
ls "$EVIDENCE"
```

It stops only the preview, Xvfb, and the two recorders that `launch.sh` recorded by PID and executable, then removes `/tmp/tether-verify`. Evidence under `verification-evidence/` (gitignored) survives. Run cleanup after every failed attempt too.

## Helpers

All scripts live in `scripts/` and are executable:

- `build-preview.sh` builds the unpacked preview app.
- `launch.sh [--real-battery] [--settings JSON] | --restart` starts the preview with its display, recorders, and fake battery.
- `doctor.sh` checks the instance without changing it.
- `battery.sh <status> <percent>` rewrites the fake battery.
- `drive.ts <snapshot | click ROLE NAME | fill LABEL VALUE | select LABEL OPTION | screenshot DIR [NAME] | close>` drives the window. Run it with `node`.
- `tray.sh <layout | click LABEL>` reads or clicks the tray menu.
- `collect.sh <dir>` copies and parses the recordings.
- `cleanup.sh` stops what the harness started and keeps evidence.

`common.sh` holds the shared paths and is sourced by the others.

## Feature map

Read [`features/README.md`](features/README.md) before driving a feature. A proof that drives one threshold is incomplete when the map lists more.
