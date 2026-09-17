import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { defaultSettings } from "../shared/settings";
import { changeSettings, loadSettings, saveSettings } from "./settings";

let directory: string;
afterEach(() => rmSync(directory, { recursive: true, force: true }));
function path() {
  directory = mkdtempSync(join(tmpdir(), "rustcharge-settings-"));
  return join(directory, "settings.json");
}

describe("settings file", () => {
  it("starts from the defaults and survives a reload", () => {
    const file = join(path(), "..", "nested", "settings.json");
    expect(loadSettings(file)).toEqual(defaultSettings);
    saveSettings(file, { ...defaultSettings, above: 90, soundPath: "/tmp/alert.wav" });
    expect(loadSettings(file)).toEqual({ ...defaultSettings, above: 90, soundPath: "/tmp/alert.wav" });
  });

  it("falls back per field", () => {
    const file = path();
    writeFileSync(file, '{"above":101,"below":15,"urgency":"loud","notifyAttempts":0,"unknown":true}');
    expect(loadSettings(file)).toEqual({ ...defaultSettings, below: 15 });
    writeFileSync(file, "not json");
    expect(loadSettings(file)).toEqual(defaultSettings);
  });
});

describe("settings changes", () => {
  it("applies every valid field", () => {
    expect(changeSettings(defaultSettings, { above: 100, belowEnabled: false, soundPath: null })).toEqual({
      ...defaultSettings,
      above: 100,
      belowEnabled: false,
    });
  });

  it("rejects the whole change for one bad field", () => {
    expect(() => changeSettings(defaultSettings, { above: 90, below: 101 })).toThrow(
      "below must be a whole number from 0 to 100.",
    );
    expect(() => changeSettings(defaultSettings, { notifyAttempts: 1.5 })).toThrow("notifyAttempts");
    expect(() => changeSettings(defaultSettings, { intervalSeconds: 0 })).toThrow("intervalSeconds");
    expect(() => changeSettings(defaultSettings, { soundPath: "" })).toThrow("Invalid soundPath.");
    expect(() => changeSettings(defaultSettings, { sec: 5 })).toThrow("Unknown setting sec.");
  });
});
