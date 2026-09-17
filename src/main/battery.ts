import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { BatteryReading } from "../shared/battery";

const run = promisify(execFile);

const LINUX_POWER_SUPPLY = "/sys/class/power_supply";

/** Reads the first system battery. `powerSupply` replaces the Linux sysfs directory. */
export async function readBattery(powerSupply = LINUX_POWER_SUPPLY): Promise<BatteryReading> {
  switch (process.platform) {
    case "linux":
      return readLinuxBattery(powerSupply);
    case "darwin":
      return parsePmset((await run("pmset", ["-g", "batt"])).stdout);
    case "win32":
      return parseWin32Battery(
        (await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", WIN32_QUERY])).stdout,
      );
    default:
      throw new Error(`Battery readings are not supported on ${process.platform}.`);
  }
}

/** Skips peripheral batteries, such as a wireless mouse's, which report a `Device` scope. */
async function readLinuxBattery(root: string): Promise<BatteryReading> {
  const read = (name: string, file: string) =>
    readFile(join(root, name, file), "utf8").then(
      (text) => text.trim(),
      () => null,
    );
  for (const name of (await readdir(root)).toSorted()) {
    if ((await read(name, "type")) !== "Battery" || (await read(name, "scope")) === "Device") continue;
    return parseLinuxBattery(await read(name, "capacity"), await read(name, "status"));
  }
  throw new Error("No battery found.");
}

export function parseLinuxBattery(capacity: string | null, status: string | null): BatteryReading {
  const percent = Number(capacity);
  if (capacity === null || capacity === "" || !Number.isFinite(percent))
    throw new Error("The battery reports no charge.");
  return { percent, charging: status === "Charging" };
}

/** `pmset -g batt` prints a line such as ` -InternalBattery-0 (id=1234)	85%; charging; 1:02 remaining present: true`. */
export function parsePmset(output: string): BatteryReading {
  const match = /InternalBattery.*?\t(\d+)%; ([^;]+);/.exec(output);
  if (!match) throw new Error("No battery found.");
  return { percent: Number(match[1]), charging: match[2] === "charging" || match[2] === "finishing charge" };
}

/** The battery driver's own status, from the same IOCTL data the Rust battery crate reads. `Win32_Battery` only
 * reports "on AC", which a full battery shares with a charging one. */
const WIN32_QUERY = [
  "$status = Get-CimInstance -Namespace root/wmi -ClassName BatteryStatus | Select-Object -First 1",
  "$full = Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity | Select-Object -First 1",
  "if ($status) { @{ remaining = $status.RemainingCapacity; full = $full.FullChargedCapacity; charging = $status.Charging } | ConvertTo-Json -Compress }",
].join("; ");

/** A machine without a battery makes the query print nothing. */
export function parseWin32Battery(output: string): BatteryReading {
  if (output.trim() === "") throw new Error("No battery found.");
  const { remaining, full, charging }: Record<string, unknown> = JSON.parse(output);
  if (typeof remaining !== "number" || typeof full !== "number" || full <= 0) {
    throw new Error("The battery reports no charge.");
  }
  return { percent: (remaining / full) * 100, charging: charging === true };
}
