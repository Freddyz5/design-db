import type {
  Column,
  Diagram,
  Id,
  Position,
  RefAction,
  Relation,
  RelationEnd,
  Table,
} from "./schema";

/**
 * Thrown when an operation cannot be applied, e.g. it points at a table
 * that does not exist. Operations keep ids consistent; problems such as
 * duplicate names are reported by `validate` instead.
 */
export class OperationError extends Error {
  override name = "OperationError";
}

/** `undefined` on an optional field removes it. */
export type TablePatch = {
  name?: string;
  comment?: string | undefined;
  /** Stored in the layout, not in the table. */
  color?: string | undefined;
};

/** `undefined` on an optional field removes it. */
export type ColumnPatch = {
  name?: string;
  type?: string;
  primaryKey?: boolean;
  nullable?: boolean;
  unique?: boolean;
  autoIncrement?: boolean;
  default?: string | undefined;
  comment?: string | undefined;
};

/** `undefined` on an optional field removes it. */
export type RelationPatch = {
  name?: string | undefined;
  onDelete?: RefAction;
  onUpdate?: RefAction;
};

export type Op =
  | { type: "table.add"; table: Table; position?: Position }
  | { type: "table.update"; tableId: Id; patch: TablePatch }
  | { type: "table.move"; tableId: Id; position: Position }
  | { type: "table.remove"; tableId: Id }
  | { type: "column.add"; tableId: Id; column: Column; index?: number }
  | { type: "column.update"; tableId: Id; columnId: Id; patch: ColumnPatch }
  | { type: "column.move"; tableId: Id; columnId: Id; index: number }
  | { type: "column.remove"; tableId: Id; columnId: Id }
  | { type: "relation.add"; relation: Relation }
  | { type: "relation.update"; relationId: Id; patch: RelationPatch }
  | { type: "relation.remove"; relationId: Id };

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
      return addColumn(doc, op.tableId, op.column, op.index);
    case "column.update":
      return updateColumn(doc, op.tableId, op.columnId, op.patch);
    case "column.move":
      return moveColumn(doc, op.tableId, op.columnId, op.index);
    case "column.remove":
      return removeColumn(doc, op.tableId, op.columnId);
    case "relation.add":
      return addRelation(doc, op.relation);
    case "relation.update":
      return updateRelation(doc, op.relationId, op.patch);
    case "relation.remove":
      return removeRelation(doc, op.relationId);
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
  return {
    ...doc,
    tables: [...doc.tables, table],
    layout: {
      ...doc.layout,
      tables: {
        ...doc.layout.tables,
        [table.id]: { x: position.x, y: position.y },
      },
    },
  };
}

function updateTable(doc: Diagram, tableId: Id, patch: TablePatch): Diagram {
  const { color, ...tablePatch } = patch;
  let next = mapTable(doc, tableId, (table) =>
    applyPatch(table, tablePatch, ["comment"]),
  );
  if ("color" in patch) {
    const current = next.layout.tables[tableId] ?? { x: 0, y: 0 };
    next = setTableLayout(
      next,
      tableId,
      applyPatch(current, { color }, ["color"]),
    );
  }
  return next;
}

function moveTable(doc: Diagram, tableId: Id, position: Position): Diagram {
  getTable(doc, tableId);
  const current = doc.layout.tables[tableId];
  return setTableLayout(doc, tableId, {
    ...current,
    x: position.x,
    y: position.y,
  });
}

/** Also removes the relations that use the table and its layout entry. */
function removeTable(doc: Diagram, tableId: Id): Diagram {
  getTable(doc, tableId);
  const { [tableId]: _removed, ...layoutTables } = doc.layout.tables;
  return {
    ...doc,
    tables: doc.tables.filter((t) => t.id !== tableId),
    relations: doc.relations.filter(
      (r) => r.from.tableId !== tableId && r.to.tableId !== tableId,
    ),
    layout: { ...doc.layout, tables: layoutTables },
  };
}

// --- Columns --------------------------------------------------------------

/** Without `index` the column goes last. Out-of-range indexes are clamped. */
function addColumn(
  doc: Diagram,
  tableId: Id,
  column: Column,
  index: number | undefined,
): Diagram {
  return mapTable(doc, tableId, (table) => {
    if (table.columns.some((c) => c.id === column.id)) {
      throw new OperationError(
        `Column ${column.id} already exists in table ${tableId}`,
      );
    }
    const at = clampIndex(index ?? table.columns.length, table.columns.length);
    const columns = [...table.columns];
    columns.splice(at, 0, column);
    return { ...table, columns };
  });
}

function updateColumn(
  doc: Diagram,
  tableId: Id,
  columnId: Id,
  patch: ColumnPatch,
): Diagram {
  return mapTable(doc, tableId, (table) => {
    getColumn(table, columnId);
    return {
      ...table,
      columns: table.columns.map((c) =>
        c.id === columnId ? applyPatch(c, patch, ["default", "comment"]) : c,
      ),
    };
  });
}

/** `index` is the final position of the column. It is clamped. */
function moveColumn(
  doc: Diagram,
  tableId: Id,
  columnId: Id,
  index: number,
): Diagram {
  return mapTable(doc, tableId, (table) => {
    const column = getColumn(table, columnId);
    const columns = table.columns.filter((c) => c.id !== columnId);
    columns.splice(clampIndex(index, columns.length), 0, column);
    return { ...table, columns };
  });
}

/** Also removes the relations that use the column. */
function removeColumn(doc: Diagram, tableId: Id, columnId: Id): Diagram {
  const next = mapTable(doc, tableId, (table) => {
    getColumn(table, columnId);
    return {
      ...table,
      columns: table.columns.filter((c) => c.id !== columnId),
    };
  });
  const uses = (end: { tableId: Id; columnIds: Id[] }) =>
    end.tableId === tableId && end.columnIds.includes(columnId);
  return {
    ...next,
    relations: next.relations.filter((r) => !uses(r.from) && !uses(r.to)),
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

function updateRelation(
  doc: Diagram,
  relationId: Id,
  patch: RelationPatch,
): Diagram {
  getRelation(doc, relationId);
  return {
    ...doc,
    relations: doc.relations.map((r) =>
      r.id === relationId ? applyPatch(r, patch, ["name"]) : r,
    ),
  };
}

function removeRelation(doc: Diagram, relationId: Id): Diagram {
  getRelation(doc, relationId);
  return {
    ...doc,
    relations: doc.relations.filter((r) => r.id !== relationId),
  };
}

function checkRelationEnd(doc: Diagram, end: RelationEnd): void {
  const table = getTable(doc, end.tableId);
  if (end.columnIds.length === 0) {
    throw new OperationError("A relation needs at least one column per end");
  }
  for (const columnId of end.columnIds) getColumn(table, columnId);
}

// --- Helpers --------------------------------------------------------------

export function getRelation(doc: Diagram, relationId: Id): Relation {
  const relation = doc.relations.find((r) => r.id === relationId);
  if (!relation) throw new OperationError(`Relation ${relationId} not found`);
  return relation;
}

export function getTable(doc: Diagram, tableId: Id): Table {
  const table = doc.tables.find((t) => t.id === tableId);
  if (!table) throw new OperationError(`Table ${tableId} not found`);
  return table;
}

export function getColumn(table: Table, columnId: Id): Column {
  const column = table.columns.find((c) => c.id === columnId);
  if (!column) {
    throw new OperationError(
      `Column ${columnId} not found in table ${table.id}`,
    );
  }
  return column;
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(Math.trunc(index), length));
}

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

function setTableLayout(
  doc: Diagram,
  tableId: Id,
  value: Diagram["layout"]["tables"][Id],
): Diagram {
  return {
    ...doc,
    layout: {
      ...doc.layout,
      tables: { ...doc.layout.tables, [tableId]: value },
    },
  };
}

/**
 * Merges `patch` into `base`. An `undefined` value removes the key when it
 * is listed in `optional`, and is ignored otherwise.
 */
function applyPatch<T extends object>(
  base: T,
  patch: object,
  optional: readonly string[],
): T {
  const next = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
    else if (optional.includes(key)) delete next[key];
  }
  return next as T;
}

function assertNever(value: never): never {
  throw new OperationError(`Unknown operation: ${JSON.stringify(value)}`);
}
