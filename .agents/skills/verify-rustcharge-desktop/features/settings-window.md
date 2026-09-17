# Settings window

Every field saves on commit: numbers on Enter or when focus leaves, switches and urgency on change. The main process validates the whole change, writes `settings.json`, then applies it. An out-of-range number shows `Enter a whole number from <min> to <max>.` and puts the saved value back. On launch, a saved field that is missing or invalid falls back to its default on its own.

Open at login writes an XDG autostart entry on Linux that launches with `--hidden`, and a login item on macOS and Windows. The switch reads the operating system each time the window opens.

## Sub-features

- Number validation and the error alert.
- Persistence across a restart.
- The `Open at login` switch and its autostart entry.
- The version line in the footer.

## How to get to it (user POV)

Open the window from the tray or a launch.

## Driving it with the harness

```sh
node $S/drive.ts fill "Check every" 0 && node $S/drive.ts snapshot | grep -E 'alert|Check every'
node $S/drive.ts fill "Low battery level" 15
node $S/drive.ts click switch "Open at login"
cat /tmp/rustcharge-desktop-verify/home/config/autostart/rustcharge-preview.desktop
$S/launch.sh --restart && node $S/drive.ts snapshot
$S/collect.sh "$EVIDENCE"
```

Proof: the alert text and `spinbutton "Check every"` keeping its saved value; the autostart file with `Exec=".../rustcharge-preview" --hidden`; after the restart, `Low battery level` still 15 and `Open at login` still on; `settings.json` in the evidence matching. Switch Open at login off again and confirm the file is gone.

## Gotchas

- The autostart entry lands in the scratch `XDG_CONFIG_HOME`, never the user's. A launch with `--hidden` opens no window, so `drive.ts` finds nothing until the tray opens it.
- The window reads settings once when it opens. After `--restart`, drive the new window, not a stale connection.
