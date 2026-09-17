import { batteryLabel } from "../shared/battery";
import type { BatteryCheck } from "../shared/battery";

export type TrayAction = "show" | "quit";
export type TrayItem = { label: string; action: TrayAction | null } | "separator";

/** A dimmed battery line, then the actions. */
export function trayItems(check: BatteryCheck | null, productName: string): TrayItem[] {
  return [
    { label: batteryLabel(check), action: null },
    "separator",
    { label: `Open ${productName}`, action: "show" },
    { label: "Quit", action: "quit" },
  ];
}
