import { batteryLabel } from "../shared/battery";
import type { BatteryCheck } from "../shared/battery";
import type { AvailableUpdate } from "../shared/ipc";

export type TrayAction = "show" | "quit";
export type TrayItem = { label: string; action: TrayAction | null } | "separator";

/** A dimmed battery line, then the actions, led by the pending update when there is one. The window
 * carries the install button, so the update item opens it. */
export function trayItems(check: BatteryCheck | null, update: AvailableUpdate | null, productName: string): TrayItem[] {
  return [
    { label: batteryLabel(check), action: null },
    "separator",
    ...(update ? [{ label: `Update to v${update.version}`, action: "show" as const }] : []),
    { label: `Open ${productName}`, action: "show" },
    { label: "Quit", action: "quit" },
  ];
}
