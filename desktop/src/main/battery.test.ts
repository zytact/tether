import { describe, expect, it } from "vite-plus/test";
import { parseLinuxBattery, parsePmset, parseWin32Battery } from "./battery";

describe("battery readings", () => {
  it("counts only a charging status as charging on Linux", () => {
    expect(parseLinuxBattery("85", "Charging")).toEqual({ percent: 85, charging: true });
    expect(parseLinuxBattery("100", "Full")).toEqual({ percent: 100, charging: false });
    expect(parseLinuxBattery("80", "Not charging")).toEqual({ percent: 80, charging: false });
    expect(() => parseLinuxBattery(null, "Charging")).toThrow("no charge");
  });

  it("reads the internal battery from pmset", () => {
    const line = (state: string) =>
      `Now drawing from 'AC Power'\n -InternalBattery-0 (id=4653155)\t86%; ${state}; 0:41 remaining present: true\n`;
    expect(parsePmset(line("charging"))).toEqual({ percent: 86, charging: true });
    expect(parsePmset(line("discharging"))).toEqual({ percent: 86, charging: false });
    expect(parsePmset(line("charged"))).toEqual({ percent: 86, charging: false });
    expect(() => parsePmset("Now drawing from 'AC Power'\n")).toThrow("No battery");
  });

  it("reads the Windows battery driver status", () => {
    expect(parseWin32Battery('{"remaining":9500,"full":50000,"charging":false}')).toEqual({
      percent: 19,
      charging: false,
    });
    expect(parseWin32Battery('{"remaining":50000,"full":50000,"charging":true}').charging).toBe(true);
    expect(() => parseWin32Battery("\r\n")).toThrow("No battery");
  });
});
