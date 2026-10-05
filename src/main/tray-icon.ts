import type { WholePercent } from "../shared/battery";

/** Each shape's minimum size and pixel scale. GNOME's AppIndicator reserves a wide icon's full pixel width
 * but draws it at panel height, so a wide icon is drawn at that height. Windows shrinks the square itself. */
export const shapes = { wide: { size: 16, scale: 2 }, square: { size: 64, scale: 8 } } as const;

// Blocky glyphs stay legible at tray sizes, and a narrow 1 keeps 100 compact.
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
// GNOME's AppIndicator extension keeps an icon wide only when it is at least 1.5 times as wide as it is
// tall, and squeezes anything narrower into a square.
const WIDE_RATIO = 1.5;

const HEALTHY = Buffer.from([0x84, 0xdc, 0x3d, 255]);
const WORN = Buffer.from([0x3d, 0xb8, 0xf5, 255]);
const FAILING = Buffer.from([0x5c, 0x5c, 0xff, 255]);

/** Draws a heart and `health` as digits, green from 80, amber from 60, and red below, as a BGRA bitmap
 * the way `nativeImage` reads it. Both shapes center the digits. A wide icon is its shape's `size` tall and
 * as wide as the digits, padded when they are too narrow to stay wide. */
export function healthIcon(health: WholePercent, shape: keyof typeof shapes) {
  const { size, scale } = shapes[shape];
  const glyphs = [
    heart,
    ...String(health)
      .split("")
      .map((digit) => digitGlyphs[digit]),
  ];
  const drawnWidth = glyphs.reduce((sum, glyph) => sum + glyph[0].length, glyphs.length - 1) * scale;
  const width = Math.max(drawnWidth, shape === "wide" ? Math.ceil(size * WIDE_RATIO) : size);
  const height = shape === "wide" ? size : width;
  const top = Math.floor((height - GLYPH_HEIGHT * scale) / 2);
  let left = Math.floor((width - drawnWidth) / 2);

  const bitmap = Buffer.alloc(width * height * 4);
  const color = health >= 80 ? HEALTHY : health >= 60 ? WORN : FAILING;
  for (const glyph of glyphs) {
    glyph.forEach((row, y) =>
      row.split("").forEach((cell, x) => {
        if (cell !== "#") return;
        for (let dy = 0; dy < scale; dy++) {
          const at = ((top + y * scale + dy) * width + left + x * scale) * 4;
          for (let dx = 0; dx < scale; dx++) bitmap.set(color, at + dx * 4);
        }
      }),
    );
    left += (glyph[0].length + 1) * scale;
  }
  return { bitmap, width, height };
}
