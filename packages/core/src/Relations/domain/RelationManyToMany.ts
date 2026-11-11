import { createColumn, type Column } from "../../Columns";
import { OperationError } from "../../shared";
import { createTable, type Table } from "../../Tables";
import { createRelation, type Relation } from "./Relation";

export type ManyToManyPlan = {
  /** Join table: one foreign key to each table, all part of its primary key. */
  table: Table;
  /** From the join table to `a`, and from the join table to `b`. */
  relations: [Relation, Relation];
};

/**
 * Plans a many-to-many relation between two tables. SQL has no direct N:M,
 * so it becomes a join table plus two relations with `onDelete: cascade`.
 *
 * Example: users + roles -> users_roles (users_id, roles_id).
 * `takenNames` are the table names already in use; the join table avoids them.
 */
export function planManyToMany(
  a: Table,
  b: Table,
  options: { name?: string; takenNames?: Iterable<string> } = {},
): ManyToManyPlan {
  const keyA = primaryKeyOf(a);
  const keyB = primaryKeyOf(b);

  const tableNames = new Set(
    [...(options.takenNames ?? [])].map((n) => n.toLowerCase()),
  );
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

  const relationTo = (table: Table, key: Column[], columns: Column[]) =>
    createRelation({
      from: { tableId: join.id, columnIds: columns.map((c) => c.id) },
      to: { tableId: table.id, columnIds: key.map((c) => c.id) },
      onDelete: "cascade",
    });

  return {
    table: join,
    relations: [relationTo(a, keyA, columnsA), relationTo(b, keyB, columnsB)],
  };
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
