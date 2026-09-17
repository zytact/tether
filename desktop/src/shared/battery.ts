export type BatteryReading = { percent: number; charging: boolean };

/** The latest battery check, as the window and tray show it. `checkedAt` is an epoch in milliseconds. */
export type BatteryCheck = { checkedAt: number } & (
  | { ok: true; reading: BatteryReading }
  | { ok: false; error: string }
);

/** One line for the tray and the window header. */
export function batteryLabel(check: BatteryCheck | null): string {
  if (check === null) return "Checking the battery";
  if (!check.ok) return "Battery unavailable";
  return `${Math.round(check.reading.percent)}% · ${check.reading.charging ? "Charging" : "Not charging"}`;
}
