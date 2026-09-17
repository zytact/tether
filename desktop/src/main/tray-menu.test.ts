import { describe, expect, it } from "vite-plus/test";
import { trayItems } from "./tray-menu";

describe("tray menu", () => {
  it("leads with the latest battery check", () => {
    const label = (items: ReturnType<typeof trayItems>) => items[0] !== "separator" && items[0].label;
    expect(label(trayItems(null, "Rustcharge"))).toBe("Checking the battery");
    expect(label(trayItems({ ok: true, reading: { percent: 84.6, charging: true }, checkedAt: 0 }, "Rustcharge"))).toBe(
      "85% · Charging",
    );
    expect(label(trayItems({ ok: false, error: "No battery found.", checkedAt: 0 }, "Rustcharge"))).toBe(
      "Battery unavailable",
    );
  });

  it("ends with the actions", () => {
    expect(trayItems(null, "Rustcharge Preview").slice(1)).toEqual([
      "separator",
      { label: "Open Rustcharge Preview", action: "show" },
      { label: "Quit", action: "quit" },
    ]);
  });
});
