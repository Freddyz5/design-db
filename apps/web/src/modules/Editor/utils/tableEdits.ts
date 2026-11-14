import {
  applyAll,
  createGroup,
  createRelation,
  type Diagram,
  type Id,
  type Issue,
  type Op,
  type Relation,
  type Table,
} from "@design-db/core";
import { GROUP_COLOR_KEYS } from "./groupColor";

/** The first of base_1, base_2… that no column of the table uses. */
export function nextColumnName(table: Table, base: string): string {
  const used = new Set(
    table.columns.map((column) => column.name.toLowerCase()),
  );
  let number = table.columns.length + 1;
  while (used.has(`${base}_${number}`)) number++;
  return `${base}_${number}`;
}

/** The relation in which the column is a foreign key, if any. */
export function columnRelation(
  diagram: Diagram,
  tableId: Id,
  columnId: Id,
): Relation | undefined {
  return diagram.relations.find(
    (relation) =>
      relation.from.tableId === tableId &&
      relation.from.columnIds.includes(columnId),
  );
}

const SERIAL: Record<string, string> = {
  serial: "integer",
  bigserial: "bigint",
  smallserial: "smallint",
};

/** The type a foreign key takes to point at a column: the same, without the auto-numbering. */
export function referenceType(type: string): string {
  return SERIAL[type.trim().toLowerCase()] ?? type;
}

/**
 * Makes the column a foreign key to `target`, or a plain column when there
 * is no target. Without a target column it points at the primary key of the
 * table (or its first column). The column takes the type of the one it
 * points at, and keeps the ON DELETE and ON UPDATE it had.
 * A relation over several columns is left alone.
 */
export function setColumnReference(
  diagram: Diagram,
  tableId: Id,
  columnId: Id,
  target: { tableId: Id; columnId?: Id } | undefined,
): Diagram {
  const old = columnRelation(diagram, tableId, columnId);
  if (old && old.from.columnIds.length > 1) return diagram;

  const ops: Op[] = [];
  if (old) ops.push({ type: "relation.remove", relationId: old.id });

  const parent = diagram.tables.find((table) => table.id === target?.tableId);
  const parentColumn =
    parent?.columns.find((column) => column.id === target?.columnId) ??
    parent?.columns.find((column) => column.primaryKey) ??
    parent?.columns[0];

  if (parent && parentColumn) {
    ops.push({
      type: "relation.add",
      relation: createRelation({
        from: { tableId, columnIds: [columnId] },
        to: { tableId: parent.id, columnIds: [parentColumn.id] },
        ...(old ? { onDelete: old.onDelete, onUpdate: old.onUpdate } : {}),
      }),
    });
    ops.push({
      type: "column.update",
      tableId,
      columnId,
      patch: { type: referenceType(parentColumn.type) },
    });
  }
  return applyAll(diagram, ops);
}

/**
 * Creates a group named "Grupo N" with a color of the palette that no other
 * group uses yet (when one is left) and puts the tables in it.
 */
export function addGroupWith(
  diagram: Diagram,
  tableIds: readonly Id[],
): { diagram: Diagram; groupId: Id } {
  const names = new Set(diagram.groups.map((group) => group.name));
  let number = diagram.groups.length + 1;
  while (names.has(`Grupo ${number}`)) number++;

  const taken = new Set(diagram.groups.map((group) => group.color));
  const color =
    GROUP_COLOR_KEYS.find((key) => !taken.has(key)) ??
    GROUP_COLOR_KEYS[diagram.groups.length % GROUP_COLOR_KEYS.length]!;

  const group = createGroup({ name: `Grupo ${number}`, color });
  return {
    groupId: group.id,
    diagram: applyAll(diagram, [
      { type: "group.add", group },
      ...tableIds.map((tableId): Op => ({
        type: "table.update",
        tableId,
        patch: { groupId: group.id },
      })),
    ]),
  };
}

/** The problems of one table, next to the field each one is about. */
export type TableIssues = {
  name: Issue[];
  group: Issue[];
  /** About the table as a whole, such as having no primary key. */
  table: Issue[];
  columns: Record<Id, Issue[]>;
};

/**
 * Sorts the problems of the diagram that belong to a table. A problem with
 * a relation shows on the foreign key column of this table.
 */
export function tableIssues(
  diagram: Diagram,
  issues: readonly Issue[],
  tableId: Id,
): TableIssues {
  const result: TableIssues = { name: [], group: [], table: [], columns: {} };
  const onColumn = (columnId: Id, issue: Issue) =>
    (result.columns[columnId] ??= []).push(issue);

  for (const issue of issues) {
    if (issue.relationId !== undefined) {
      const relation = diagram.relations.find((r) => r.id === issue.relationId);
      const [first] = relation?.from.columnIds ?? [];
      if (relation?.from.tableId === tableId && first !== undefined) {
        onColumn(first, issue);
      }
      continue;
    }
    if (issue.tableId !== tableId) continue;

    if (issue.columnId !== undefined) onColumn(issue.columnId, issue);
    else if (issue.code.endsWith("-table-name")) result.name.push(issue);
    else if (issue.code === "table-missing-group") result.group.push(issue);
    else result.table.push(issue);
  }
  return result;
}
