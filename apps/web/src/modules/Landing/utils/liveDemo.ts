import {
  importSchema,
  toDbml,
  toDrizzle,
  type Diagram,
  type Table,
} from "@design-db/core";

/** The SQL the demo starts with. */
export const DEMO_SQL = `CREATE TABLE users (
  id int PRIMARY KEY,
  email varchar(255) NOT NULL UNIQUE,
  name varchar(100)
);

CREATE TABLE posts (
  id int PRIMARY KEY,
  author_id int NOT NULL REFERENCES users (id),
  title varchar(200) NOT NULL
);`;

/** One row of a table in the demo: the column, its type and what it is. */
export type DemoRow = {
  name: string;
  type: string;
  detail: string;
  key: boolean;
};

/** A table of the demo, ready to draw. */
export type DemoTable = { id: string; name: string; rows: DemoRow[] };

/** What the demo shows for the SQL typed in it. */
export type DemoResult =
  | { ok: true; tables: DemoTable[]; dbml: string; drizzle: string }
  | { ok: false; line: number; message: string };

function rowsOf(diagram: Diagram, table: Table): DemoRow[] {
  return table.columns.map((column) => {
    const relation = diagram.relations.find(
      (r) => r.from.tableId === table.id && r.from.columnIds[0] === column.id,
    );
    const parent = diagram.tables.find((t) => t.id === relation?.to.tableId);
    const target = parent?.columns.find(
      (c) => c.id === relation?.to.columnIds[0],
    );
    const detail = column.primaryKey
      ? "PK"
      : parent && target
        ? `→ ${parent.name}.${target.name}`
        : column.unique
          ? "UQ"
          : column.nullable
            ? "NULL"
            : "";
    return {
      name: column.name,
      type: column.type,
      detail,
      key: column.primaryKey,
    };
  });
}

/** Reads the SQL of the demo with the same code the editor uses, and writes it as DBML and Drizzle. */
export function readDemo(sql: string): DemoResult {
  const read = importSchema(sql, "sql");
  if (!read.ok) {
    const [first] = read.errors;
    return { ok: false, line: first?.line ?? 1, message: first?.message ?? "" };
  }
  const diagram: Diagram = {
    ...read.diagram,
    name: "Mi esquema",
    dialect: "postgres",
  };
  return {
    ok: true,
    tables: diagram.tables.map((table) => ({
      id: table.name,
      name: table.name,
      rows: rowsOf(diagram, table),
    })),
    dbml: toDbml(diagram),
    drizzle: toDrizzle(diagram),
  };
}
