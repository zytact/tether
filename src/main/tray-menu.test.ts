import { describe, expect, it } from "vite-plus/test";
import { trayItems } from "./tray-menu";

describe("tray menu", () => {
  it("leads with the latest battery check", () => {
    const label = (items: ReturnType<typeof trayItems>) => items[0] !== "separator" && items[0].label;
    expect(label(trayItems(null, null, "Tether"))).toBe("Checking the battery");
    expect(
      label(trayItems({ ok: true, reading: { percent: 84.6, charging: true }, checkedAt: 0 }, null, "Tether")),
    ).toBe("85% · Charging");
    expect(label(trayItems({ ok: false, error: "No battery found.", checkedAt: 0 }, null, "Tether"))).toBe(
      "Battery unavailable",
    );
  });

  it("ends with the actions", () => {
    expect(trayItems(null, null, "Tether Preview").slice(1)).toEqual([
      "separator",
      { label: "Open Tether Preview", action: "show" },
      { label: "Quit", action: "quit" },
    ]);
  });

  it("leads the actions with a pending update", () => {
    expect(trayItems(null, { version: "3.1.0" }, "Tether").slice(1, 3)).toEqual([
      "separator",
      { label: "Update to v3.1.0", action: "show" },
    ]);
  });
});
