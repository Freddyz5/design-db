/**
 * The colors a group can take from the theme. A group stores one of these
 * keys, or a hex color when it comes from imported code.
 */
export const GROUP_COLOR_KEYS = [
  "blue",
  "green",
  "red",
  "purple",
  "teal",
  "amber",
  "magenta",
  "slate",
] as const;
export type GroupColorKey = (typeof GROUP_COLOR_KEYS)[number];

/** The header strip of a table: its background and the text on it, as CSS colors. */
export type Strip = { background: string; ink: string };

const DARK_INK = "#0b0b0d";
const LIGHT_INK = "#ffffff";
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Relative luminance of a hex color, from 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const digits = hex.slice(1);
  const full =
    digits.length === 3
      ? [...digits].map((digit) => digit + digit).join("")
      : digits;
  const [red, green, blue] = [0, 2, 4].map((at) => {
    const channel = parseInt(full.slice(at, at + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

/**
 * The strip for a group or table color. A palette key uses the theme token,
 * a hex color is used as is with the ink that reads best on it, and no
 * color (or one that is not understood) gives the neutral strip.
 */
export function stripColors(color: string | undefined): Strip {
  const key = GROUP_COLOR_KEYS.indexOf(color as GroupColorKey);
  if (key !== -1) {
    return {
      background: `var(--color-group-${key + 1})`,
      ink: "var(--color-on-group)",
    };
  }
  if (color !== undefined && HEX.test(color)) {
    // White reads better than black on anything darker than this.
    return {
      background: color,
      ink: luminance(color) > 0.3 ? DARK_INK : LIGHT_INK,
    };
  }
  return { background: "var(--color-flap-edge)", ink: "var(--color-on-group)" };
}
