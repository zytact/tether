#!/usr/bin/env bash
# Set the fake battery the running preview reads on its next check.
# Usage: battery.sh <Charging|Discharging|Full|Not charging> <percent 0-100>
set -euo pipefail
. "$(dirname "$0")/common.sh"
status="${1:?usage: battery.sh <Charging|Discharging|Full|Not charging> <percent>}"
percent="${2:?usage: battery.sh <status> <percent>}"

mkdir -p "$POWER_SUPPLY/BAT0" "$POWER_SUPPLY/AC"
# A wireless mouse's battery comes first and must be skipped by its Device scope.
mkdir -p "$POWER_SUPPLY/0-hidpp_battery_0"
printf 'Battery\n' >"$POWER_SUPPLY/0-hidpp_battery_0/type"
printf 'Device\n' >"$POWER_SUPPLY/0-hidpp_battery_0/scope"
printf '5\n' >"$POWER_SUPPLY/0-hidpp_battery_0/capacity"
printf 'Discharging\n' >"$POWER_SUPPLY/0-hidpp_battery_0/status"
printf 'Mains\n' >"$POWER_SUPPLY/AC/type"
printf 'Battery\n' >"$POWER_SUPPLY/BAT0/type"
printf '%s\n' "$percent" >"$POWER_SUPPLY/BAT0/capacity"
printf '%s\n' "$status" >"$POWER_SUPPLY/BAT0/status"

echo "$(date +%H:%M:%S) battery -> $status $percent%" | tee -a "$RUN_DIR/battery-timeline.log"
