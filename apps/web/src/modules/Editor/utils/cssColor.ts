const RGB =
  /^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)/i;

/**
 * A computed CSS color (`rgb(44, 95, 142)`, as the browser reports it) as a
 * hex color, which the color input needs. A hex color is returned as it is,
 * in lowercase; anything else gives `fallback`.
 */
export function cssColorToHex(color: string, fallback = "#000000"): string {
  const value = color.trim();
  if (/^#[0-9a-f]{6}$/i.test(value)) return value.toLowerCase();
  const match = RGB.exec(value);
  if (!match) return fallback;
  return `#${match
    .slice(1, 4)
    .map((part) =>
      Math.min(255, Math.round(Number(part)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}
