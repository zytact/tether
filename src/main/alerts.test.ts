import { describe, expect, it } from "vite-plus/test";
import { defaultSettings } from "../shared/settings";
import type { Settings } from "../shared/settings";
import { crossedThreshold, nextAlert, settingsChanged } from "./alerts";
import type { AlertSession } from "./alerts";

const settings = (change: Partial<Settings> = {}): Settings => ({ ...defaultSettings, ...change });

describe("crossed threshold", () => {
  it("includes the threshold itself and follows the charging state", () => {
    expect(crossedThreshold(settings(), { percent: 85, charging: true })).toBe("above");
    expect(crossedThreshold(settings(), { percent: 84.9, charging: true })).toBeNull();
    expect(crossedThreshold(settings(), { percent: 20, charging: false })).toBe("below");
    expect(crossedThreshold(settings(), { percent: 20.1, charging: false })).toBeNull();
    expect(crossedThreshold(settings(), { percent: 95, charging: false })).toBeNull();
    expect(crossedThreshold(settings(), { percent: 5, charging: true })).toBeNull();
  });

  it("ignores a switched-off threshold", () => {
    expect(crossedThreshold(settings({ aboveEnabled: false }), { percent: 95, charging: true })).toBeNull();
    expect(crossedThreshold(settings({ belowEnabled: false }), { percent: 5, charging: false })).toBeNull();
  });
});

describe("alert sessions", () => {
  const run = (crossings: ("above" | "below" | null)[], attempts: number) => {
    let session: AlertSession = null;
    return crossings.map((crossed) => {
      const next = nextAlert(session, crossed, attempts);
      session = next.session;
      return next.alert;
    });
  };

  it("stops after the attempt limit until the battery leaves the threshold", () => {
    expect(run(["below", "below", "below", "below", null, "below"], 2)).toEqual([
      true,
      true,
      false,
      false,
      false,
      true,
    ]);
  });

  it("starts a fresh session when the battery moves straight to the other threshold", () => {
    expect(run(["above", "above", "below"], 2)).toEqual([true, true, true]);
  });

  it("resumes a spent session when the limit is raised", () => {
    expect(nextAlert({ threshold: "above", sent: 2 }, "above", 2).alert).toBe(false);
    expect(nextAlert({ threshold: "above", sent: 2 }, "above", 3)).toEqual({
      session: { threshold: "above", sent: 3 },
      alert: true,
    });
  });
});

describe("settings changes", () => {
  const spentAbove: AlertSession = { threshold: "above", sent: 15 };
  const activeBelow: AlertSession = { threshold: "below", sent: 1 };

  it("ends a changed threshold's session and checks at once", () => {
    expect(settingsChanged(spentAbove, settings(), settings({ above: 90 }))).toEqual({
      session: null,
      effect: "evaluate",
    });
    expect(settingsChanged(spentAbove, settings(), settings({ aboveEnabled: false }))).toEqual({
      session: null,
      effect: "evaluate",
    });
    expect(settingsChanged(null, settings({ belowEnabled: false }), settings())).toEqual({
      session: null,
      effect: "evaluate",
    });
  });

  it("keeps the other threshold's session and its next check", () => {
    expect(settingsChanged(activeBelow, settings(), settings({ above: 90 }))).toEqual({
      session: activeBelow,
      effect: "keep",
    });
    expect(settingsChanged(spentAbove, settings(), settings({ belowEnabled: false }))).toEqual({
      session: spentAbove,
      effect: "keep",
    });
  });

  it("restarts the interval only when it changes", () => {
    expect(settingsChanged(activeBelow, settings(), settings({ intervalSeconds: 30 })).effect).toBe("reschedule");
    expect(settingsChanged(activeBelow, settings(), settings({ above: 85 })).effect).toBe("keep");
  });

  it("keeps the attempt count through sound, urgency and attempt changes", () => {
    const next = settings({ soundPath: "/tmp/alert.wav", urgency: "critical", notifyAttempts: 3 });
    expect(settingsChanged(activeBelow, settings(), next)).toEqual({ session: activeBelow, effect: "keep" });
  });
});
