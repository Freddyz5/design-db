import { patchColumn, type Column, type ColumnPatch } from "../../Columns";
import { OperationError, type Id } from "../../shared";
import { getColumn, type Table } from "./Table";

/** Without `index` the column goes last. Out-of-range indexes are clamped. */
export function addColumn(table: Table, column: Column, index?: number): Table {
  if (table.columns.some((c) => c.id === column.id)) {
    throw new OperationError(
      `Column ${column.id} already exists in table ${table.id}`,
    );
  }
  const columns = [...table.columns];
  columns.splice(
    clampIndex(index ?? columns.length, columns.length),
    0,
    column,
  );
  return { ...table, columns };
}

export function updateColumn(
  table: Table,
  columnId: Id,
  patch: ColumnPatch,
): Table {
  getColumn(table, columnId);
  return {
    ...table,
    columns: table.columns.map((c) =>
      c.id === columnId ? patchColumn(c, patch) : c,
    ),
  };
}

/** `index` is the final position of the column. It is clamped. */
export function moveColumn(table: Table, columnId: Id, index: number): Table {
  const column = getColumn(table, columnId);
  const columns = table.columns.filter((c) => c.id !== columnId);
  columns.splice(clampIndex(index, columns.length), 0, column);
  return { ...table, columns };
}

export function removeColumn(table: Table, columnId: Id): Table {
  getColumn(table, columnId);
  return {
    ...table,
    columns: table.columns.filter((c) => c.id !== columnId),
  };
}

function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(Math.trunc(index), length));
}
