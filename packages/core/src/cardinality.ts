import type { Diagram, Id, Relation, Table } from "./schema";

export type Cardinality = {
  /** One parent row for each child row ("1:1"), or for many ("1:N"). */
  kind: "1:1" | "1:N";
  /** A child row may have no parent, because a foreign key column is nullable. */
  optional: boolean;
};

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

/**
 * Works out the cardinality from the foreign key columns, so it can never
 * contradict them. Returns null if the relation points at something that
 * does not exist.
 */
export function getCardinality(
  doc: Diagram,
  relation: Relation,
): Cardinality | null {
  const child = doc.tables.find((t) => t.id === relation.from.tableId);
  const parent = doc.tables.find((t) => t.id === relation.to.tableId);
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
