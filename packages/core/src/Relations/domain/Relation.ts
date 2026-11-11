import { z } from "zod";
import { applyPatch, createId, IdSchema, type Id } from "../../shared";

/** What the database does with the child rows when the parent changes. */
export const RefActionSchema = z.enum([
  "no action",
  "cascade",
  "set null",
  "restrict",
]);
export type RefAction = z.infer<typeof RefActionSchema>;

export const RelationEndSchema = z.object({
  tableId: IdSchema,
  columnIds: z.array(IdSchema).min(1),
});
export type RelationEnd = z.infer<typeof RelationEndSchema>;

/**
 * A relation is a foreign key: `from` is the child table that holds the
 * foreign key columns, `to` is the parent table they point at.
 */
export const RelationSchema = z.object({
  id: IdSchema,
  name: z.string().optional(),
  from: RelationEndSchema,
  to: RelationEndSchema,
  onDelete: RefActionSchema,
  onUpdate: RefActionSchema,
});
export type Relation = z.infer<typeof RelationSchema>;

/** `undefined` on an optional field removes it. */
export type RelationPatch = {
  name?: string | undefined;
  onDelete?: RefAction;
  onUpdate?: RefAction;
};

export function createRelation(
  init: Pick<Relation, "from" | "to"> & Partial<Relation>,
): Relation {
  const relation: Relation = {
    id: init.id ?? createId(),
    from: init.from,
    to: init.to,
    onDelete: init.onDelete ?? "no action",
    onUpdate: init.onUpdate ?? "no action",
  };
  if (init.name !== undefined) relation.name = init.name;
  return relation;
}

/** Returns a copy of the relation with the patch applied. */
export function patchRelation(
  relation: Relation,
  patch: RelationPatch,
): Relation {
  return applyPatch(relation, patch, ["name"]);
}

/** True if either end of the relation is in the table. */
export function usesTable(relation: Relation, tableId: Id): boolean {
  return relation.from.tableId === tableId || relation.to.tableId === tableId;
}

/** True if either end of the relation uses the column. */
export function usesColumn(
  relation: Relation,
  tableId: Id,
  columnId: Id,
): boolean {
  const uses = (end: RelationEnd) =>
    end.tableId === tableId && end.columnIds.includes(columnId);
  return uses(relation.from) || uses(relation.to);
}
