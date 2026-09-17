# High battery alerts

While the battery is charging and sits at or above the high level, each check sends a notification titled `Battery Status: Charging` with the body `Charge: <rounded percent>%`. The level is inclusive.

## Sub-features

- The `High battery level` field, from 0 to 100, default 85.
- The `High battery alerts` switch, default on.

## How to get to it (user POV)

Open the window. The `High battery` row holds the level and the switch. Alerts arrive while the charger is in and the battery has reached the level.

## Driving it with the harness

```sh
$S/launch.sh --settings '{"intervalSeconds":2,"notifyAttempts":50}'
$S/battery.sh Charging 84 && sleep 5 && $S/collect.sh "$EVIDENCE"
$S/battery.sh Charging 85 && sleep 5 && $S/collect.sh "$EVIDENCE"
node $S/drive.ts click switch "High battery alerts" && $S/collect.sh "$EVIDENCE"
sleep 6 && $S/collect.sh "$EVIDENCE"
```

Proof: no `Charging` notification at 84, alerts at 85, and the count stays the same across the six seconds after the switch turns off. The snapshot shows the switch `Off`.

## Gotchas

- `Full 100` does not alert, since a full battery is not charging. That matches the Rust CLI.
- Discharging at 95 never alerts high.
