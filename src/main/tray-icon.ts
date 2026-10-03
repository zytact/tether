import type { WholePercent } from "../shared/battery";

export const TRAY_ICON_SIZE = 64;

// Blocky glyphs stay legible once the panel shrinks the icon to 16 to 24 pixels, and a narrow 1 keeps
// 100 compact.
const digitGlyphs: Record<string, string[]> = {
  "0": ["###", "#.#", "#.#", "#.#", "###"],
  "1": ["#", "#", "#", "#", "#"],
  "2": ["###", "..#", "###", "#..", "###"],
  "3": ["###", "..#", "###", "..#", "###"],
  "4": ["#.#", "#.#", "###", "..#", "..#"],
  "5": ["###", "#..", "###", "..#", "###"],
  "6": ["###", "#..", "###", "#.#", "###"],
  "7": ["###", "..#", "..#", "..#", "..#"],
  "8": ["###", "#.#", "###", "#.#", "###"],
  "9": ["###", "#.#", "###", "..#", "###"],
};
const heart = [".#.#.", "#####", "#####", ".###.", "..#.."];
const GLYPH_HEIGHT = 5;
const SCALE = 8;
// GNOME's AppIndicator extension keeps an icon wide only when it is at least 1.5 times as wide as it is
// tall, and squeezes anything narrower into a square.
const WIDE_RATIO = 1.5;

const HEALTHY = Buffer.from([0x84, 0xdc, 0x3d, 255]);
const WORN = Buffer.from([0x3d, 0xb8, 0xf5, 255]);
const FAILING = Buffer.from([0x5c, 0x5c, 0xff, 255]);

/** Draws a heart and `health` as digits, green from 80, amber from 60, and red below, as a BGRA bitmap
 * the way `nativeImage` reads it. Both shapes center the digits. A wide icon is `TRAY_ICON_SIZE` tall and
 * as wide as the digits, padded when they are too narrow to stay wide. */
export function healthIcon(health: WholePercent, shape: "wide" | "square") {
  const glyphs = [
    heart,
    ...String(health)
      .split("")
      .map((digit) => digitGlyphs[digit]),
  ];
  const drawnWidth = glyphs.reduce((sum, glyph) => sum + glyph[0].length, glyphs.length - 1) * SCALE;
  const width = Math.max(drawnWidth, shape === "wide" ? Math.ceil(TRAY_ICON_SIZE * WIDE_RATIO) : TRAY_ICON_SIZE);
  const height = shape === "wide" ? TRAY_ICON_SIZE : width;
  const top = Math.floor((height - GLYPH_HEIGHT * SCALE) / 2);
  let left = Math.floor((width - drawnWidth) / 2);

  const bitmap = Buffer.alloc(width * height * 4);
  const color = health >= 80 ? HEALTHY : health >= 60 ? WORN : FAILING;
  for (const glyph of glyphs) {
    glyph.forEach((row, y) =>
      row.split("").forEach((cell, x) => {
        if (cell !== "#") return;
        for (let dy = 0; dy < SCALE; dy++) {
          const at = ((top + y * SCALE + dy) * width + left + x * SCALE) * 4;
          for (let dx = 0; dx < SCALE; dx++) bitmap.set(color, at + dx * 4);
        }
      }),
    );
    left += (glyph[0].length + 1) * SCALE;
  }
  return { bitmap, width, height };
}
