# Sound and urgency

With a sound chosen, each alert plays that file in a hidden window and the notification is silent, so the two never overlap. Without one, the notification keeps the system sound. An alert that arrives while the previous sound still plays skips its sound and logs `Skipped the alert sound`. A file that cannot be read or decoded logs `Failed to play`.

Urgency is Linux-only. It sets the notification's `urgency` hint: Low 0, Normal 1, Critical 2. Other platforms hide the row.

## Sub-features

- `Choose` opens a native file dialog for an audio file.
- `Clear` returns to the system sound. The row shows the file name, with the full path as its tooltip.
- The `Urgency` combobox.

## How to get to it (user POV)

The `Sound` and `Urgency` rows in the window.

## Driving it with the harness

The file dialog is native and cannot be driven, so seed the path:

```sh
$S/launch.sh --settings "{\"intervalSeconds\":2,\"notifyAttempts\":2,\"soundPath\":\"$PWD/$EVIDENCE/beep.wav\"}"
node $S/drive.ts select Urgency Critical
$S/battery.sh Discharging 10 && sleep 6 && $S/collect.sh "$EVIDENCE"
node $S/drive.ts click button Clear && node $S/drive.ts snapshot | grep -A1 'heading "Sound"'
```

Proof: `notifications.txt` shows `urgency=2`, `audio-streams.txt` lists a `tether-preview` stream inside the alert window, and `preview.log` has no `Failed to play`. After `Clear`, the row reads `The system notification sound.` and `settings.json` holds `"soundPath": null`.

## Gotchas

- Audio streams do not map one to one onto plays. Pair them with the notification count and `preview.log`.
- A sound longer than the interval makes the next alert skip its sound. That is expected.
- Pressing `Choose` under Xvfb opens a dialog nobody can close. Do not click it.
