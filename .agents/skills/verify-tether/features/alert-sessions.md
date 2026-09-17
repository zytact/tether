# Alert sessions

Crossing a level starts a session that sends at most `Alerts per crossing` notifications, one per check. After that the app stays quiet until the battery leaves the level. Leaving and crossing again, or moving straight to the other level, starts a new session.

Settings changes act on sessions:

- Changing a level or its switch ends that level's session and reads the battery at once, so a new level can alert without waiting for the interval.
- The same change while the other level has a session keeps that session and its next check.
- Changing `Check every` starts a new interval from the change.
- Raising `Alerts per crossing` lets a spent session alert again on the next check. Sound and urgency changes keep the count.

## Sub-features

- The `Alerts per crossing` field, at least 1, default 15.
- The `Check every` field, from 1 to 86400 seconds, default 120.

## How to get to it (user POV)

Both fields sit below the level rows in the window. The effects show up as the alerts that do or do not arrive.

## Driving it with the harness

```sh
$S/launch.sh --settings '{"intervalSeconds":3,"notifyAttempts":2}'
$S/battery.sh Discharging 12 && sleep 8 && $S/collect.sh "$EVIDENCE"     # 2, then quiet
node $S/drive.ts fill "Low battery level" 15 && sleep 1 && $S/collect.sh "$EVIDENCE"   # 3 at once
$S/battery.sh Discharging 50 && sleep 4 && $S/battery.sh Discharging 12 && sleep 4 && $S/collect.sh "$EVIDENCE"
```

Proof: the count stops at 2 across further checks, jumps to 3 within a second of the level change instead of waiting for the interval, and a return to 50% followed by 12% starts another session. Read the times in `notifications.raw` against `battery-timeline.log` for the interval.

## Gotchas

- A session is spent after exactly `notifyAttempts` notifications. Budget `sleep` for `notifyAttempts * intervalSeconds` plus a check.
- Committing a number equal to the saved one changes nothing and triggers no check.
