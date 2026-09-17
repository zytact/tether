import { describe, expect, it } from "vite-plus/test";
import { defaultSettings } from "../shared/settings";
import { alertNotification } from "./notification";

describe("alert notification", () => {
  it("names the charging state and rounds the charge", () => {
    expect(alertNotification({ percent: 12.5, charging: false }, defaultSettings, "darwin")).toEqual({
      title: "Battery Status: Discharging",
      body: "Charge: 13%",
      silent: false,
    });
  });

  it("sets urgency only on Linux and silences the system sound when a sound is chosen", () => {
    const settings = { ...defaultSettings, urgency: "critical" as const, soundPath: "/tmp/alert.wav" };
    expect(alertNotification({ percent: 90, charging: true }, settings, "linux")).toMatchObject({
      urgency: "critical",
      silent: true,
    });
    expect(alertNotification({ percent: 90, charging: true }, settings, "win32")).not.toHaveProperty("urgency");
  });
});
