import type { NotificationConstructorOptions } from "electron";
import type { BatteryReading } from "../shared/battery";
import type { Settings } from "../shared/settings";

/** The alert for a reading. A chosen sound replaces the notification's own, and urgency is set only on Linux,
 * the one platform whose notification servers read it. */
export function alertNotification(
  { percent, charging }: BatteryReading,
  { soundPath, urgency }: Settings,
  platform: NodeJS.Platform,
): NotificationConstructorOptions {
  return {
    title: `Battery Status: ${charging ? "Charging" : "Discharging"}`,
    body: `Charge: ${Math.round(percent)}%`,
    silent: soundPath !== null,
    ...(platform === "linux" && { urgency }),
  };
}
