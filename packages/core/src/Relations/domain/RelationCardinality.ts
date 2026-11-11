import { isUniqueKey, type Table } from "../../Tables";
import type { Relation } from "./Relation";

export type Cardinality = {
  /** One parent row for each child row ("1:1"), or for many ("1:N"). */
  kind: "1:1" | "1:N";
  /** A child row may have no parent, because a foreign key column is nullable. */
  optional: boolean;
};

/**
 * Works out the cardinality from the foreign key columns, so it can never
 * contradict them. Returns null if the relation points at something that
 * does not exist. Accepts a diagram or anything with its tables.
 */
export function getCardinality(
  diagram: { tables: readonly Table[] },
  relation: Relation,
): Cardinality | null {
  const child = diagram.tables.find((t) => t.id === relation.from.tableId);
  const parent = diagram.tables.find((t) => t.id === relation.to.tableId);
  if (!child || !parent) return null;

  const foreignKey = relation.from.columnIds.map((id) =>
    child.columns.find((c) => c.id === id),
  );
  const target = relation.to.columnIds.map((id) =>
    parent.columns.find((c) => c.id === id),
  );
  if (foreignKey.includes(undefined) || target.includes(undefined)) {
    return null;
  }

  return {
    kind: isUniqueKey(child, relation.from.columnIds) ? "1:1" : "1:N",
    optional: foreignKey.some((c) => c!.nullable),
  };
}
