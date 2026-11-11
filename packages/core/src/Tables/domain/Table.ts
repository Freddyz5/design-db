import { z } from "zod";
import { ColumnSchema, type Column } from "../../Columns";
import {
  applyPatch,
  createId,
  IdSchema,
  OperationError,
  type Id,
} from "../../shared";

export const TableSchema = z.object({
  id: IdSchema,
  name: z.string(),
  comment: z.string().optional(),
  /** Order matters: it is the order shown in the editor and in the SQL. */
  columns: z.array(ColumnSchema),
});
export type Table = z.infer<typeof TableSchema>;

/** `undefined` on an optional field removes it. */
export type TablePatch = {
  name?: string;
  comment?: string | undefined;
};

export function createTable(init: Partial<Table> = {}): Table {
  const table: Table = {
    id: init.id ?? createId(),
    name: init.name ?? "table",
    columns: init.columns ?? [],
  };
  if (init.comment !== undefined) table.comment = init.comment;
  return table;
}

/** Returns a copy of the table with the patch applied. */
export function patchTable(table: Table, patch: TablePatch): Table {
  return applyPatch(table, patch, ["comment"]);
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

/**
 * True if no two rows can share the same values in these columns: they
 * include the whole primary key, or a column marked as unique.
 */
export function isUniqueKey(table: Table, columnIds: readonly Id[]): boolean {
  const ids = new Set(columnIds);
  const primaryKey = table.columns.filter((c) => c.primaryKey);
  if (primaryKey.length > 0 && primaryKey.every((c) => ids.has(c.id))) {
    return true;
  }
  return table.columns.some((c) => c.unique && ids.has(c.id));
}
