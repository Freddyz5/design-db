import { z } from "zod";
import { applyPatch, createId, IdSchema } from "../../shared";

export const ColumnSchema = z.object({
  id: IdSchema,
  name: z.string(),
  /** Free text, e.g. "varchar(255)" or "int". */
  type: z.string(),
  primaryKey: z.boolean(),
  nullable: z.boolean(),
  unique: z.boolean(),
  autoIncrement: z.boolean(),
  default: z.string().optional(),
  comment: z.string().optional(),
});
export type Column = z.infer<typeof ColumnSchema>;

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

/** Columns are nullable by default, except primary keys. */
export function createColumn(init: Partial<Column> = {}): Column {
  const primaryKey = init.primaryKey ?? false;
  const column: Column = {
    id: init.id ?? createId(),
    name: init.name ?? "column",
    type: init.type ?? "text",
    primaryKey,
    nullable: init.nullable ?? !primaryKey,
    unique: init.unique ?? false,
    autoIncrement: init.autoIncrement ?? false,
  };
  if (init.default !== undefined) column.default = init.default;
  if (init.comment !== undefined) column.comment = init.comment;
  return column;
}

/** Returns a copy of the column with the patch applied. */
export function patchColumn(column: Column, patch: ColumnPatch): Column {
  return applyPatch(column, patch, ["default", "comment"]);
}
