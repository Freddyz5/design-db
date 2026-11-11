import type { Column, ColumnPatch } from "../../Columns";
import { isEnumType, patchEnum, type Enum, type EnumPatch } from "../../Enums";
import { patchGroup, type Group, type GroupPatch } from "../../Groups";
import {
  patchRelation,
  usesColumn,
  usesTable,
  type Relation,
  type RelationEnd,
  type RelationPatch,
} from "../../Relations";
import { applyPatch, OperationError, type Id } from "../../shared";
import {
  addColumn,
  getColumn,
  moveColumn,
  patchTable,
  removeColumn,
  updateColumn,
  type Table,
  type TablePatch,
} from "../../Tables";
import {
  getEnum,
  getGroup,
  getRelation,
  getTable,
  type Diagram,
  type Position,
  type TableLayout,
} from "./Diagram";

/** Table fields plus its color, which is stored in the layout. */
export type TableUpdatePatch = TablePatch & { color?: string | undefined };

export type Op =
  | { type: "table.add"; table: Table; position?: Position }
  | { type: "table.update"; tableId: Id; patch: TableUpdatePatch }
  | { type: "table.move"; tableId: Id; position: Position }
  | { type: "table.remove"; tableId: Id }
  | { type: "column.add"; tableId: Id; column: Column; index?: number }
  | { type: "column.update"; tableId: Id; columnId: Id; patch: ColumnPatch }
  | { type: "column.move"; tableId: Id; columnId: Id; index: number }
  | { type: "column.remove"; tableId: Id; columnId: Id }
  | { type: "relation.add"; relation: Relation }
  | { type: "relation.update"; relationId: Id; patch: RelationPatch }
  | { type: "relation.remove"; relationId: Id }
  | { type: "group.add"; group: Group }
  | { type: "group.update"; groupId: Id; patch: GroupPatch }
  | { type: "group.remove"; groupId: Id }
  | { type: "enum.add"; enum: Enum }
  | { type: "enum.update"; enumId: Id; patch: EnumPatch }
  | { type: "enum.remove"; enumId: Id }
  | { type: "layout.place"; positions: Record<Id, Position> };

/**
 * Applies one operation and returns a new diagram.
 * The diagram passed in is never modified.
 */
export function apply(doc: Diagram, op: Op): Diagram {
  switch (op.type) {
    case "table.add":
      return addTable(doc, op.table, op.position ?? { x: 0, y: 0 });
    case "table.update":
      return updateTable(doc, op.tableId, op.patch);
    case "table.move":
      return moveTable(doc, op.tableId, op.position);
    case "table.remove":
      return removeTable(doc, op.tableId);
    case "column.add":
      return mapTable(doc, op.tableId, (t) =>
        addColumn(t, op.column, op.index),
      );
    case "column.update":
      return mapTable(doc, op.tableId, (t) =>
        updateColumn(t, op.columnId, op.patch),
      );
    case "column.move":
      return mapTable(doc, op.tableId, (t) =>
        moveColumn(t, op.columnId, op.index),
      );
    case "column.remove":
      return removeColumnAndRelations(doc, op.tableId, op.columnId);
    case "relation.add":
      return addRelation(doc, op.relation);
    case "relation.update":
      getRelation(doc, op.relationId);
      return mapRelations(doc, (r) =>
        r.id === op.relationId ? patchRelation(r, op.patch) : r,
      );
    case "relation.remove":
      getRelation(doc, op.relationId);
      return {
        ...doc,
        relations: doc.relations.filter((r) => r.id !== op.relationId),
      };
    case "group.add":
      if (doc.groups.some((g) => g.id === op.group.id)) {
        throw new OperationError(`Group ${op.group.id} already exists`);
      }
      return { ...doc, groups: [...doc.groups, op.group] };
    case "group.update":
      getGroup(doc, op.groupId);
      return {
        ...doc,
        groups: doc.groups.map((g) =>
          g.id === op.groupId ? patchGroup(g, op.patch) : g,
        ),
      };
    case "group.remove":
      return removeGroup(doc, op.groupId);
    case "enum.add":
      if (doc.enums.some((e) => e.id === op.enum.id)) {
        throw new OperationError(`Enum ${op.enum.id} already exists`);
      }
      return { ...doc, enums: [...doc.enums, op.enum] };
    case "enum.update":
      return updateEnum(doc, op.enumId, op.patch);
    case "enum.remove":
      getEnum(doc, op.enumId);
      return { ...doc, enums: doc.enums.filter((e) => e.id !== op.enumId) };
    case "layout.place":
      return placeTables(doc, op.positions);
    default:
      return assertNever(op);
  }
}

/** Applies several operations in order. */
export function applyAll(doc: Diagram, ops: readonly Op[]): Diagram {
  return ops.reduce(apply, doc);
}

// --- Tables ---------------------------------------------------------------

function addTable(doc: Diagram, table: Table, position: Position): Diagram {
  if (doc.tables.some((t) => t.id === table.id)) {
    throw new OperationError(`Table ${table.id} already exists`);
  }
  if (table.groupId !== undefined) getGroup(doc, table.groupId);
  return setTableLayout({ ...doc, tables: [...doc.tables, table] }, table.id, {
    x: position.x,
    y: position.y,
  });
}

function updateTable(
  doc: Diagram,
  tableId: Id,
  patch: TableUpdatePatch,
): Diagram {
  const { color, ...fields } = patch;
  if (fields.groupId !== undefined) getGroup(doc, fields.groupId);
  const next = mapTable(doc, tableId, (t) => patchTable(t, fields));
  if (!("color" in patch)) return next;
  const current = next.layout.tables[tableId] ?? { x: 0, y: 0 };
  return setTableLayout(
    next,
    tableId,
    applyPatch(current, { color }, ["color"]),
  );
}

function moveTable(doc: Diagram, tableId: Id, position: Position): Diagram {
  getTable(doc, tableId);
  return setTableLayout(doc, tableId, {
    ...doc.layout.tables[tableId],
    x: position.x,
    y: position.y,
  });
}

/** Moves several tables at once, e.g. after an automatic layout. */
function placeTables(doc: Diagram, positions: Record<Id, Position>): Diagram {
  const tables = { ...doc.layout.tables };
  for (const [tableId, position] of Object.entries(positions)) {
    getTable(doc, tableId);
    tables[tableId] = { ...tables[tableId], x: position.x, y: position.y };
  }
  return { ...doc, layout: { ...doc.layout, tables } };
}

/** Also removes the relations that use the table and its layout entry. */
function removeTable(doc: Diagram, tableId: Id): Diagram {
  getTable(doc, tableId);
  const { [tableId]: _removed, ...layoutTables } = doc.layout.tables;
  return {
    ...doc,
    tables: doc.tables.filter((t) => t.id !== tableId),
    relations: doc.relations.filter((r) => !usesTable(r, tableId)),
    layout: { ...doc.layout, tables: layoutTables },
  };
}

// --- Columns --------------------------------------------------------------

/** Also removes the relations that use the column. */
function removeColumnAndRelations(
  doc: Diagram,
  tableId: Id,
  columnId: Id,
): Diagram {
  const next = mapTable(doc, tableId, (t) => removeColumn(t, columnId));
  return {
    ...next,
    relations: next.relations.filter((r) => !usesColumn(r, tableId, columnId)),
  };
}

// --- Relations ------------------------------------------------------------

/**
 * Both ends must point at existing tables and columns. Other problems,
 * such as a different number of columns on each end, are left to `validate`.
 */
function addRelation(doc: Diagram, relation: Relation): Diagram {
  if (doc.relations.some((r) => r.id === relation.id)) {
    throw new OperationError(`Relation ${relation.id} already exists`);
  }
  checkRelationEnd(doc, relation.from);
  checkRelationEnd(doc, relation.to);
  return { ...doc, relations: [...doc.relations, relation] };
}

function checkRelationEnd(doc: Diagram, end: RelationEnd): void {
  const table = getTable(doc, end.tableId);
  if (end.columnIds.length === 0) {
    throw new OperationError("A relation needs at least one column per end");
  }
  for (const columnId of end.columnIds) getColumn(table, columnId);
}

// --- Groups ---------------------------------------------------------------

/** Its tables stay in the diagram, without a group. */
function removeGroup(doc: Diagram, groupId: Id): Diagram {
  getGroup(doc, groupId);
  return {
    ...doc,
    groups: doc.groups.filter((g) => g.id !== groupId),
    tables: doc.tables.map((t) =>
      t.groupId === groupId ? patchTable(t, { groupId: undefined }) : t,
    ),
  };
}

// --- Enums ----------------------------------------------------------------

/** Renaming an enum also renames the type of the columns that use it. */
function updateEnum(doc: Diagram, enumId: Id, patch: EnumPatch): Diagram {
  const current = getEnum(doc, enumId);
  const next = {
    ...doc,
    enums: doc.enums.map((e) => (e.id === enumId ? patchEnum(e, patch) : e)),
  };
  if (patch.name === undefined || patch.name === current.name) return next;
  const name = patch.name;
  return {
    ...next,
    tables: next.tables.map((t) =>
      t.columns.some((c) => isEnumType(current, c.type))
        ? {
            ...t,
            columns: t.columns.map((c) =>
              isEnumType(current, c.type) ? { ...c, type: name } : c,
            ),
          }
        : t,
    ),
  };
}

// --- Helpers --------------------------------------------------------------

function mapTable(
  doc: Diagram,
  tableId: Id,
  fn: (table: Table) => Table,
): Diagram {
  getTable(doc, tableId);
  return {
    ...doc,
    tables: doc.tables.map((t) => (t.id === tableId ? fn(t) : t)),
  };
}

function mapRelations(
  doc: Diagram,
  fn: (relation: Relation) => Relation,
): Diagram {
  return { ...doc, relations: doc.relations.map(fn) };
}

function setTableLayout(
  doc: Diagram,
  tableId: Id,
  value: TableLayout,
): Diagram {
  return {
    ...doc,
    layout: {
      ...doc.layout,
      tables: { ...doc.layout.tables, [tableId]: value },
    },
  };
}

function assertNever(value: never): never {
  throw new OperationError(`Unknown operation: ${JSON.stringify(value)}`);
}
