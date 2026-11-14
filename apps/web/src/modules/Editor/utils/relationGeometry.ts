/** One end of a relation: where it touches the table, and which way is out of it (1 right, -1 left). */
export type RelationEnd = { x: number; y: number; out: 1 | -1 };

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * The curve of a relation, as in the mockup: it leaves each table straight
 * out of its side and bends between them. Ends on opposite sides bend with
 * the distance between them; ends on the same side, or a table related to
 * itself, loop out with the height between them.
 */
export function relationCurve(
  from: RelationEnd,
  to: RelationEnd,
  self = false,
): string {
  const rise = Math.abs(from.y - to.y);
  const reach = self
    ? Math.max(44, rise * 0.35 + 30)
    : from.out === to.out
      ? Math.max(46, rise * 0.22)
      : Math.max(40, Math.abs(to.x - from.x) * 0.45);
  return (
    `M${from.x} ${from.y} ` +
    `C${round(from.x + from.out * reach)} ${from.y} ` +
    `${round(to.x + to.out * reach)} ${to.y} ${to.x} ${to.y}`
  );
}

/** The mark at the foreign key's end: a crow's foot for many, a bar for one. */
export function childMark({ x, y, out }: RelationEnd, many: boolean): string {
  return many
    ? `M${x} ${y - 6} L${x + out * 11} ${y} L${x} ${y + 6}`
    : `M${x + out * 9} ${y - 6} V${y + 6}`;
}

/**
 * The marks at the referenced end: a bar, then a second bar when a row
 * always has its parent, or a circle where the foreign key can be empty.
 */
export function parentMarks(
  { x, y, out }: RelationEnd,
  optional: boolean,
): { path: string; circle: { cx: number; cy: number } | null } {
  const bar = (at: number) => `M${x + out * at} ${y - 6} V${y + 6}`;
  return optional
    ? { path: bar(6), circle: { cx: x + out * 14, cy: y } }
    : { path: `${bar(6)} ${bar(11)}`, circle: null };
}
