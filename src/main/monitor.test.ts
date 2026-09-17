import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { BatteryReading } from "../shared/battery";
import { defaultSettings } from "../shared/settings";
import { Monitor } from "./monitor";

let battery: BatteryReading;
let monitor: Monitor;
let alerts: number;

beforeEach(async () => {
  vi.useFakeTimers();
  battery = { percent: 50, charging: false };
  alerts = 0;
  monitor = new Monitor(
    { ...defaultSettings, intervalSeconds: 60 },
    { readBattery: async () => battery, alert: () => alerts++, checked: () => {} },
  );
  monitor.start();
  await vi.advanceTimersByTimeAsync(0);
});
afterEach(() => vi.useRealTimers());

describe("monitor", () => {
  it("alerts on the interval while the battery is past a threshold", async () => {
    battery = { percent: 10, charging: false };
    await vi.advanceTimersByTimeAsync(59_999);
    expect(alerts).toBe(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(alerts).toBe(1);
  });

  it("checks at once when a threshold changes, then restarts the interval", async () => {
    await vi.advanceTimersByTimeAsync(30_000);
    monitor.update({ ...monitor.settings, below: 60 });
    await vi.advanceTimersByTimeAsync(0);
    expect(alerts).toBe(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(alerts).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(alerts).toBe(2);
  });

  it("keeps the next check through a sound change and restarts it on an interval change", async () => {
    battery = { percent: 10, charging: false };
    await vi.advanceTimersByTimeAsync(30_000);
    monitor.update({ ...monitor.settings, soundPath: "/tmp/alert.wav" });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(alerts).toBe(1);

    monitor.update({ ...monitor.settings, intervalSeconds: 10 });
    await vi.advanceTimersByTimeAsync(9_999);
    expect(alerts).toBe(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(alerts).toBe(2);
  });

  it("sends one alert when a threshold changes while a reading is in flight", async () => {
    let land = () => {};
    const readings: BatteryReading[] = [];
    const slow = new Monitor(
      { ...defaultSettings, above: 90 },
      {
        readBattery: () => new Promise((resolve) => (land = () => resolve({ percent: 85, charging: true }))),
        alert: (reading) => readings.push(reading),
        checked: () => {},
      },
    );
    slow.start();
    slow.update({ ...slow.settings, above: 80 });
    land();
    await vi.advanceTimersByTimeAsync(0);
    expect(readings).toHaveLength(1);
  });
});
