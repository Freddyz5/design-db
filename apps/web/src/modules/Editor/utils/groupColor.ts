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

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * The color of a group or table, as a CSS color: a palette key uses the
 * theme token, a hex color is used as is, and no color (or one that is not
 * understood) gives the ink of the sheets.
 */
export function groupColor(color: string | undefined): string {
  const key = GROUP_COLOR_KEYS.indexOf(color as GroupColorKey);
  if (key !== -1) return `var(--color-group-${key + 1})`;
  if (color !== undefined && HEX.test(color)) return color;
  return "var(--color-sheet-edge)";
}

/**
 * The header strip of a table, as on a technical sheet: a light tint of its
 * color with the name in that color. The name mixes in the sheet's ink, so it
 * reads in both themes whatever the color: darker on paper, lighter at night.
 * Without a color, the neutral header of the sheets.
 */
export function stripColors(color: string | undefined): Strip {
  const base = groupColor(color);
  if (base === "var(--color-sheet-edge)") {
    return {
      background: "var(--color-sheet-head)",
      ink: "var(--color-sheet-head-ink)",
    };
  }
  return {
    background: `color-mix(in srgb, ${base} 16%, var(--color-sheet))`,
    ink: `color-mix(in srgb, ${base} 70%, var(--color-sheet-ink))`,
  };
}
