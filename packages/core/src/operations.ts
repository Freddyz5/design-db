import type { Diagram, Id, Position, Table } from "./schema";

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

export type Op =
  | { type: "table.add"; table: Table; position?: Position }
  | { type: "table.update"; tableId: Id; patch: TablePatch }
  | { type: "table.move"; tableId: Id; position: Position }
  | { type: "table.remove"; tableId: Id };

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

// --- Helpers --------------------------------------------------------------

export function getTable(doc: Diagram, tableId: Id): Table {
  const table = doc.tables.find((t) => t.id === tableId);
  if (!table) throw new OperationError(`Table ${tableId} not found`);
  return table;
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
