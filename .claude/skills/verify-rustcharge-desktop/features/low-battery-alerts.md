# Low battery alerts

While the battery is not charging and sits at or below the low level, each check sends a notification titled `Battery Status: Discharging` with the body `Charge: <rounded percent>%`. The level is inclusive. Any status other than `Charging`, including `Full` and `Not charging`, counts as not charging.

## Sub-features

- The `Low battery level` field, from 0 to 100, default 20.
- The `Low battery alerts` switch, default on.
- The header line, which shows the latest reading.
- Skipping a peripheral battery with a `Device` scope.

## How to get to it (user POV)

Open Rustcharge from the tray or a launch. The `Low battery` row holds the level and the switch. Alerts arrive on their own when the battery drains to the level.

## Driving it with the harness

```sh
$S/launch.sh --settings '{"intervalSeconds":2,"notifyAttempts":3}'
$S/battery.sh Discharging 21 && sleep 5 && $S/collect.sh "$EVIDENCE"   # 0 notifications
$S/battery.sh Discharging 20 && sleep 5 && $S/collect.sh "$EVIDENCE"   # alerts start
node $S/drive.ts snapshot | grep paragraph | head -1                  # 20% · Not charging
```

Proof: `notifications.txt` gains `summary=Battery Status: Discharging | body=Charge: 20%` only after the change to 20, and the header reads `20% · Not charging`, not the fake mouse battery's 5%.

## Gotchas

- `Charging 10` never alerts low, and `Full 10` does, since only `Charging` counts as charging.
- The switch off must stop alerts at once. Use a large `notifyAttempts` so the limit does not stop them first.
