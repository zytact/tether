import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from "node:fs";
import { dirname } from "node:path";
import { defaultSettings, numberRanges, settingRules } from "../shared/settings";
import type { SettingKey, Settings } from "../shared/settings";

const ranges: Partial<Record<SettingKey, { min: number; max: number }>> = numberRanges;

const isSettingKey = (key: string): key is SettingKey => Object.hasOwn(settingRules, key);

function assign<K extends SettingKey>(settings: Settings, key: K, value: unknown): boolean {
  if (!settingRules[key](value)) return false;
  settings[key] = value;
  return true;
}

/** Each saved field that is missing or no longer valid falls back to its default on its own, so one bad
 * value never resets the rest. */
export function loadSettings(path: string): Settings {
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (typeof parsed === "object" && parsed !== null) saved = { ...parsed };
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      console.error(`Failed to read settings at ${path}:`, error);
    }
  }
  const settings = { ...defaultSettings };
  for (const [key, value] of Object.entries(saved)) {
    if (isSettingKey(key) && !assign(settings, key, value)) console.error(`Ignoring the saved ${key} setting.`);
  }
  return settings;
}

/** The settings with `change` applied. The change comes from the window, so every field is checked and an
 * unknown or invalid one rejects the whole change. */
export function changeSettings(current: Settings, change: unknown): Settings {
  if (typeof change !== "object" || change === null) throw new Error("A settings change must be an object.");
  const next = { ...current };
  for (const [key, value] of Object.entries(change)) {
    if (!isSettingKey(key)) throw new Error(`Unknown setting ${key}.`);
    if (assign(next, key, value)) continue;
    const range = ranges[key];
    throw new Error(range ? `${key} must be a whole number from ${range.min} to ${range.max}.` : `Invalid ${key}.`);
  }
  return next;
}

/** Writes through a synced temporary file and a rename, so a failed save leaves the previous file whole. */
export function saveSettings(path: string, settings: Settings) {
  const directory = dirname(path);
  const temporary = `${path}.${process.pid}.tmp`;
  mkdirSync(directory, { recursive: true });
  try {
    const file = openSync(temporary, "w", 0o600);
    try {
      writeSync(file, JSON.stringify(settings, null, 2));
      fsyncSync(file);
    } finally {
      closeSync(file);
    }
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}
