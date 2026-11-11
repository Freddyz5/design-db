import { createColumn, createRelation, createTable } from "./factories";
import { applyAll, getTable, OperationError, type Op } from "./operations";
import type { Column, Diagram, Id, Position, Table } from "./schema";

/**
 * Creates a many-to-many relation between two tables. SQL has no direct
 * N:M, so this adds a join table whose primary key is made of one foreign
 * key to each table, plus the two relations.
 *
 * Example: users + roles -> users_roles (users_id, roles_id).
 */
export function createManyToMany(
  doc: Diagram,
  tableAId: Id,
  tableBId: Id,
  options: { name?: string } = {},
): { diagram: Diagram; tableId: Id } {
  const a = getTable(doc, tableAId);
  const b = getTable(doc, tableBId);
  const keyA = primaryKeyOf(a);
  const keyB = primaryKeyOf(b);

  const tableNames = new Set(doc.tables.map((t) => t.name.toLowerCase()));
  const name = uniqueName(options.name ?? `${a.name}_${b.name}`, tableNames);

  const columnNames = new Set<string>();
  const foreignKeyTo = (table: Table, key: Column[]) =>
    key.map((pk) =>
      createColumn({
        name: uniqueName(`${table.name}_${pk.name}`, columnNames),
        type: pk.type,
        primaryKey: true,
        nullable: false,
      }),
    );
  const columnsA = foreignKeyTo(a, keyA);
  const columnsB = foreignKeyTo(b, keyB);
  const join = createTable({ name, columns: [...columnsA, ...columnsB] });

  const relationTo = (table: Table, key: Column[], columns: Column[]): Op => ({
    type: "relation.add",
    relation: createRelation({
      from: { tableId: join.id, columnIds: columns.map((c) => c.id) },
      to: { tableId: table.id, columnIds: key.map((c) => c.id) },
      onDelete: "cascade",
    }),
  });

  const diagram = applyAll(doc, [
    { type: "table.add", table: join, position: middle(doc, a.id, b.id) },
    relationTo(a, keyA, columnsA),
    relationTo(b, keyB, columnsB),
  ]);
  return { diagram, tableId: join.id };
}

function primaryKeyOf(table: Table): Column[] {
  const key = table.columns.filter((c) => c.primaryKey);
  if (key.length === 0) {
    throw new OperationError(
      `Table "${table.name}" needs a primary key to be part of a many-to-many relation`,
    );
  }
  return key;
}

/** Adds _2, _3… until the name is free. Comparison ignores case. */
function uniqueName(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base}_${n}`;
  taken.add(name.toLowerCase());
  return name;
}

/** Halfway between both tables, so the join table appears between them. */
function middle(doc: Diagram, aId: Id, bId: Id): Position {
  const a = doc.layout.tables[aId];
  const b = doc.layout.tables[bId];
  if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const one = a ?? b;
  return one ? { x: one.x, y: one.y } : { x: 0, y: 0 };
}
