import type { WholePercent } from "../shared/battery";

export const TRAY_ICON_SIZE = 64;

// Blocky glyphs stay legible once the panel shrinks the icon to 16 to 24 pixels, and a narrow 1 lets
// 100 draw as large as two digits.
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
const MAX_SCALE = 9;

const HEALTHY = Buffer.from([0x84, 0xdc, 0x3d, 255]);
const WORN = Buffer.from([0x3d, 0xb8, 0xf5, 255]);
const FAILING = Buffer.from([0x5c, 0x5c, 0xff, 255]);

/** Draws a heart and `health` as digits on a transparent square, green from 80, amber from 60, and red
 * below. The result is a BGRA bitmap, as `nativeImage` reads it. */
export function healthIcon(health: WholePercent): Buffer {
  const glyphs = [
    heart,
    ...String(health)
      .split("")
      .map((digit) => digitGlyphs[digit]),
  ];
  const width = glyphs.reduce((sum, glyph) => sum + glyph[0].length, glyphs.length - 1);
  const scale = Math.min(MAX_SCALE, Math.floor(TRAY_ICON_SIZE / width));
  const top = Math.floor((TRAY_ICON_SIZE - GLYPH_HEIGHT * scale) / 2);
  let left = Math.floor((TRAY_ICON_SIZE - width * scale) / 2);

  const bitmap = Buffer.alloc(TRAY_ICON_SIZE * TRAY_ICON_SIZE * 4);
  const color = health >= 80 ? HEALTHY : health >= 60 ? WORN : FAILING;
  for (const glyph of glyphs) {
    glyph.forEach((row, y) =>
      row.split("").forEach((cell, x) => {
        if (cell === "#") fill(bitmap, left + x * scale, top + y * scale, scale, color);
      }),
    );
    left += (glyph[0].length + 1) * scale;
  }
  return bitmap;
}

function fill(bitmap: Buffer, left: number, top: number, size: number, pixel: Buffer) {
  for (let y = top; y < top + size; y++) {
    for (let x = left; x < left + size; x++) bitmap.set(pixel, (y * TRAY_ICON_SIZE + x) * 4);
  }
}
