import { describe, expect, it } from "vite-plus/test";
import { batteryHealth } from "../shared/battery";
import { healthIcon, TRAY_ICON_SIZE } from "./tray-icon";

const icon = (value: number, shape: "wide" | "square" = "wide") =>
  healthIcon(
    batteryHealth({ ok: true, reading: { percent: 50, charging: false, health: value }, checkedAt: 0 })!,
    shape,
  );

/** The icon's size, its lit pixels' bounding box, and the color of the first one. */
function drawn({ bitmap, width, height }: ReturnType<typeof healthIcon>) {
  let [left, top, right, bottom] = [width, height, -1, -1];
  let color: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      if (bitmap[at + 3] === 0) continue;
      if (color.length === 0) color = [...bitmap.subarray(at, at + 4)];
      [left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x), Math.max(bottom, y)];
    }
  }
  return { width, height, left, top, right, bottom, color };
}

const centered = (start: number, end: number, size: number) => Math.abs(start - (size - 1 - end)) <= 1;

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

  it("keeps a wide icon one height, as wide as its digits, and wide enough for GNOME", () => {
    const [two, three] = [drawn(icon(99)), drawn(icon(100))];
    for (const drawing of [two, three]) {
      expect(drawing.height).toBe(TRAY_ICON_SIZE);
      expect([drawing.left, drawing.right]).toEqual([0, drawing.width - 1]);
      expect(centered(drawing.top, drawing.bottom, drawing.height)).toBe(true);
    }
    expect(three.bottom - three.top).toBe(two.bottom - two.top);
    for (const value of [7, 42, 100]) {
      const { width, height } = drawn(icon(value));
      expect(width).toBeGreaterThanOrEqual(height * 1.5);
    }
  });

  it("centers every width of reading inside a square icon", () => {
    for (const value of [7, 42, 100]) {
      const square = drawn(icon(value, "square"));
      expect(square.width).toBe(square.height);
      expect(centered(square.left, square.right, square.width)).toBe(true);
      expect(centered(square.top, square.bottom, square.height)).toBe(true);
    }
  });
});
