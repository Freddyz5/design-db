/**
 * The colors a group can take from the theme. A group stores one of these
 * keys, or a hex color when it comes from imported code or the picker.
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

/** The zone of a group on the canvas: its dashed outline and its fill, as CSS colors. */
export type Zone = { border: string; fill: string };

/** The intensities the editor offers, as a factor of the default (1). */
export const INTENSITY = { min: 0.5, max: 2, step: 0.1 } as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** A percentage for `color-mix`, rounded so equal inputs give equal strings. */
const pct = (value: number) => `${Math.round(value * 10) / 10}%`;

/** Whether a stored color is a hex color, which the picker can edit. */
export function isHexColor(color: string | undefined): color is string {
  return color !== undefined && HEX.test(color);
}

/**
 * The color of a group or table, as a CSS color: a palette key uses the
 * theme token, and no color (or one that is not understood) gives the ink of
 * the sheets. A hex color is used as is on paper and lightened at night, as
 * the palette does, so a dark color chosen by day still reads in the dark.
 */
export function groupColor(color: string | undefined): string {
  const key = GROUP_COLOR_KEYS.indexOf(color as GroupColorKey);
  if (key !== -1) return `var(--color-group-${key + 1})`;
  if (isHexColor(color)) {
    return `light-dark(${color}, color-mix(in oklab, ${color} 55%, #ffffff))`;
  }
  return "var(--color-sheet-edge)";
}

/**
 * The header strip of a table, as on a technical sheet: a light tint of its
 * color with the name in that color. The name mixes in the sheet's ink, so it
 * reads in both themes whatever the color: darker on paper, lighter at night.
 * The intensity scales the tint, within what keeps the name readable.
 * Without a color, the neutral header of the sheets.
 */
export function stripColors(color: string | undefined, intensity = 1): Strip {
  const base = groupColor(color);
  if (base === "var(--color-sheet-edge)") {
    return {
      background: "var(--color-sheet-head)",
      ink: "var(--color-sheet-head-ink)",
    };
  }
  return {
    background: `color-mix(in srgb, ${base} ${pct(clamp(16 * intensity, 5, 32))}, var(--color-sheet))`,
    ink: `color-mix(in srgb, ${base} 70%, var(--color-sheet-ink))`,
  };
}

/**
 * The zone of a group: a dashed outline in its color and a faint fill that
 * lets the grid show through. The intensity makes both fainter or stronger;
 * the fill grows faster, so the strongest still reads as a zone, not a block.
 */
export function zoneColors(color: string, intensity = 1): Zone {
  return {
    border: `color-mix(in srgb, ${color} ${pct(clamp(45 + 30 * intensity, 55, 100))}, transparent)`,
    fill: `color-mix(in srgb, ${color} ${pct(clamp(5 * intensity ** 1.5, 1.5, 14))}, transparent)`,
  };
}
