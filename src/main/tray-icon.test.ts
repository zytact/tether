import { describe, expect, it } from "vite-plus/test";
import { batteryHealth } from "../shared/battery";
import { healthIcon, TRAY_ICON_SIZE } from "./tray-icon";

const icon = (value: number) =>
  healthIcon(batteryHealth({ ok: true, reading: { percent: 50, charging: false, health: value }, checkedAt: 0 })!);

/** The lit pixels' bounding box, and the color of the first one. */
function drawn(bitmap: Buffer) {
  let [left, top, right, bottom] = [TRAY_ICON_SIZE, TRAY_ICON_SIZE, -1, -1];
  let color: number[] = [];
  for (let y = 0; y < TRAY_ICON_SIZE; y++) {
    for (let x = 0; x < TRAY_ICON_SIZE; x++) {
      const at = (y * TRAY_ICON_SIZE + x) * 4;
      if (bitmap[at + 3] === 0) continue;
      if (color.length === 0) color = [...bitmap.subarray(at, at + 4)];
      [left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x), Math.max(bottom, y)];
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1, color };
}

describe("tray icon", () => {
  it("colors the health green from 80, amber from 60, and red below", () => {
    const [green, amber, red] = [
      [0x84, 0xdc, 0x3d, 255],
      [0x3d, 0xb8, 0xf5, 255],
      [0x5c, 0x5c, 0xff, 255],
    ];
    expect([100, 80, 79, 60, 59, 0].map((value) => drawn(icon(value)).color)).toEqual([
      green,
      green,
      amber,
      amber,
      red,
      red,
    ]);
  });

  it("centers every width of reading inside the icon", () => {
    for (const value of [0, 7, 42, 100]) {
      const { left, top, width, height } = drawn(icon(value));
      expect(width).toBeLessThanOrEqual(TRAY_ICON_SIZE);
      expect(Math.abs(TRAY_ICON_SIZE - width - 2 * left)).toBeLessThanOrEqual(1);
      expect(Math.abs(TRAY_ICON_SIZE - height - 2 * top)).toBeLessThanOrEqual(1);
    }
  });

  it("draws 100 as large as two digits", () => {
    expect(drawn(icon(100)).height).toBe(drawn(icon(99)).height);
  });
});
