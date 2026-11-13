import type { Column, Diagram, Table } from "@design-db/core";
import {
  TABLE_NOTE_GAP,
  TABLE_NOTE_LETTERS,
  TABLE_NOTE_LINE,
} from "../constants/canvas";

/** Where a foreign key points: the table and column, and the number of the table's group when it is another group. */
export type ColumnReference = {
  table: string;
  column: string;
  /** From 1, in the order of the groups. Null when both tables share a group, or the target has none. */
  group: number | null;
};

/** What a column row says besides its name and type. */
export type ColumnFace = {
  /** The constraints in words, as on a data sheet: "PK", "not null, unique, default now()". */
  rules: string;
  reference: ColumnReference | null;
  /** The values of the enum the column's type names, if it names one. */
  enumValues: readonly string[] | null;
};

/** A serial type already counts up: it needs no "identity". */
const SERIAL = /serial/i;

/**
 * The constraints of a column in words. A primary key says "PK"; any other
 * column says whether it can be empty. "unique" is left out on the only
 * primary key, which is unique already.
 */
export function columnRules(column: Column, table: Table): string {
  const keys = table.columns.filter((c) => c.primaryKey).length;
  const rules = [
    column.primaryKey ? "PK" : column.nullable ? "null" : "not null",
  ];
  if (column.unique && !(column.primaryKey && keys === 1)) rules.push("unique");
  if (column.autoIncrement && !SERIAL.test(column.type)) rules.push("identity");
  if (column.default !== undefined && column.default !== "") {
    rules.push(`default ${column.default}`);
  }
  return rules.join(", ");
}

/** Where a column points, if it is a foreign key. */
export function columnReference(
  diagram: Diagram,
  table: Table,
  column: Column,
): ColumnReference | null {
  for (const relation of diagram.relations) {
    if (relation.from.tableId !== table.id) continue;
    const at = relation.from.columnIds.indexOf(column.id);
    if (at === -1) continue;
    const parent = diagram.tables.find((t) => t.id === relation.to.tableId);
    const target = parent?.columns.find(
      (c) => c.id === relation.to.columnIds[at],
    );
    if (!parent || !target) continue;
    const index = diagram.groups.findIndex((g) => g.id === parent.groupId);
    const otherGroup = index !== -1 && parent.groupId !== table.groupId;
    return {
      table: parent.name,
      column: target.name,
      group: otherGroup ? index + 1 : null,
    };
  }
  return null;
}

/** The values of the enum a type names, whatever its case. */
export function enumValues(
  diagram: Diagram,
  type: string,
): readonly string[] | null {
  const name = type.trim().toLowerCase();
  return (
    diagram.enums.find((e) => e.name.toLowerCase() === name)?.values ?? null
  );
}

/** What each column row of a table says besides its name and type. */
export function columnFaces(
  diagram: Diagram,
  table: Table,
): Record<string, ColumnFace> {
  return Object.fromEntries(
    table.columns.map((column) => [
      column.id,
      {
        rules: columnRules(column, table),
        reference: columnReference(diagram, table, column),
        enumValues: enumValues(diagram, column.type),
      },
    ]),
  );
}

/** The room a table's note takes under it: about how many lines it wraps to. Nothing without a note. */
export function noteHeight(note: string | null): number {
  if (!note) return 0;
  const lines = note
    .split("\n")
    .reduce(
      (sum, paragraph) =>
        sum + Math.max(1, Math.ceil(paragraph.length / TABLE_NOTE_LETTERS)),
      0,
    );
  return TABLE_NOTE_GAP + lines * TABLE_NOTE_LINE;
}
