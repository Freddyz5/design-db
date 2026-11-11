import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import {
  apply,
  createExampleDiagram,
  validate,
  type Diagram,
} from "../../Diagrams";
import { createTable } from "../../Tables";
import { toDrizzle } from "./DrizzleExport";
import { sampleDiagram } from "./FormatFixtures";
import { importSchema } from "./SchemaImport";

function read(text: string) {
  const result = importSchema(text, "drizzle");
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result;
}

/** The schema by names, with types, defaults and comments. */
function shape(doc: Diagram) {
  const table = (id: string) => doc.tables.find((t) => t.id === id)!;
  const column = (tableId: string, id: string) =>
    table(tableId).columns.find((c) => c.id === id)!.name;
  return {
    tables: doc.tables.map((t) => ({
      name: t.name,
      comment: t.comment,
      columns: t.columns.map((c) => [
        c.name,
        c.type,
        c.primaryKey,
        c.nullable,
        c.unique,
        c.autoIncrement,
        c.default,
        c.comment,
      ]),
    })),
    relations: doc.relations.map((r) => [
      table(r.from.tableId).name,
      r.from.columnIds.map((id) => column(r.from.tableId, id)),
      table(r.to.tableId).name,
      r.to.columnIds.map((id) => column(r.to.tableId, id)),
      r.name,
      r.onDelete,
      r.onUpdate,
    ]),
    enums: doc.enums.map((e) => [e.name, e.values, e.note]),
  };
}

/** One table, to check how a single column is read. */
function columnOf(code: string) {
  const { diagram, warnings } = read(
    `import { sql } from "drizzle-orm";
import * as p from "drizzle-orm/pg-core";
export const t = p.pgTable("t", { ${code} });`,
  );
  return { column: diagram.tables[0]!.columns[0], warnings };
}

describe("readDrizzle", () => {
  test("round trip through PostgreSQL keeps the schema", () => {
    const original = sampleDiagram();
    const result = read(toDrizzle(original, "postgres"));
    expect(result.diagram.dialect).toBe("postgres");
    expect(shape(result.diagram)).toEqual(shape(original));
    expect(result.warnings).toEqual([]);
  });

  test("round trip through SQLite keeps the schema", () => {
    const original = { ...sampleDiagram(), dialect: "sqlite" as const };
    const result = read(toDrizzle(original));
    expect(result.diagram.dialect).toBe("sqlite");
    expect(shape(result.diagram)).toEqual(shape(original));
  });

  test("round trip through MySQL gives MySQL types", () => {
    const result = read(toDrizzle(sampleDiagram(), "mysql"));
    expect(result.diagram.dialect).toBe("mysql");
    const posts = result.diagram.tables.find((t) => t.name === "posts")!;
    expect(posts.columns.map((c) => c.type)).toEqual([
      "int",
      "int",
      "post_status",
      "int",
      "text",
    ]);
    expect(result.diagram.enums.map((e) => e.name)).toEqual(["post_status"]);
  });

  test("the example has no issues after a round trip", () => {
    for (const dialect of ["postgres", "mysql", "sqlite"] as const) {
      const result = read(toDrizzle(createExampleDiagram(), dialect));
      expect(result.warnings).toEqual([]);
      expect(result.diagram.tables).toHaveLength(5);
      expect(result.diagram.relations).toHaveLength(5);
      expect(validate(result.diagram)).toEqual([]);
    }
  });

  test("composite keys, named relations, self references and custom types", () => {
    const doc = apply(sampleDiagram(), {
      type: "table.add",
      table: createTable({
        name: "Post Links",
        comment: "First line\nends with */",
        columns: [
          createColumn({ name: "post_id", type: "integer", primaryKey: true }),
          createColumn({
            name: "parent_id",
            type: "integer",
            primaryKey: true,
          }),
          createColumn({ name: "shape", type: "geometry(point,4326)" }),
        ],
      }),
    });
    const links = doc.tables.at(-1)!;
    const posts = doc.tables.find((t) => t.name === "posts")!;
    const withRelations = [
      {
        type: "relation.add" as const,
        relation: {
          id: "r1",
          name: "fk_link_post",
          from: { tableId: links.id, columnIds: [links.columns[0]!.id] },
          to: { tableId: posts.id, columnIds: [posts.columns[0]!.id] },
          onDelete: "cascade" as const,
          onUpdate: "restrict" as const,
        },
      },
      {
        type: "relation.add" as const,
        relation: {
          id: "r2",
          from: {
            tableId: links.id,
            columnIds: [links.columns[1]!.id, links.columns[0]!.id],
          },
          to: {
            tableId: links.id,
            columnIds: [links.columns[0]!.id, links.columns[1]!.id],
          },
          onDelete: "no action" as const,
          onUpdate: "no action" as const,
        },
      },
    ].reduce(apply, doc);
    const result = read(toDrizzle(withRelations));
    expect(shape(result.diagram)).toEqual(shape(withRelations));
  });

  test("namespace imports, schemas, callbacks, spreads and no semicolons", () => {
    const { diagram, warnings } = read(`import { relations } from "drizzle-orm"
import * as p from "drizzle-orm/pg-core"

const timestamps = {
  createdAt: p.timestamp("created_at").defaultNow().notNull(),
}

export const auth = p.pgSchema("auth")
export const role = auth.enum("role", ["admin", "member"])

export const users = auth.table("users", {
  id: p.serial().primaryKey(),
  role: role().default("member"),
  ...timestamps,
}).enableRLS()

export const posts = p.pgTable("posts", (t) => ({
  id: t.uuid().defaultRandom().primaryKey(),
  authorId: t.integer("author_id").references(() => users.id),
}), (t) => [p.index("author_idx").on(t.authorId)])

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}))

export type User = typeof users.$inferSelect
`);
    expect(warnings).toEqual([]);
    expect(shape(diagram)).toEqual({
      tables: [
        {
          name: "users",
          comment: undefined,
          columns: [
            ["id", "serial", true, false, false, true, undefined, undefined],
            ["role", "role", false, true, false, false, "'member'", undefined],
            [
              "created_at",
              "timestamp",
              false,
              false,
              false,
              false,
              "now()",
              undefined,
            ],
          ],
        },
        {
          name: "posts",
          comment: undefined,
          columns: [
            [
              "id",
              "uuid",
              true,
              false,
              false,
              false,
              "gen_random_uuid()",
              undefined,
            ],
            [
              "author_id",
              "integer",
              false,
              true,
              false,
              false,
              undefined,
              undefined,
            ],
          ],
        },
      ],
      relations: [
        [
          "posts",
          ["author_id"],
          "users",
          ["id"],
          undefined,
          "no action",
          "no action",
        ],
      ],
      enums: [["role", ["admin", "member"], undefined]],
    });
  });

  test("aliased imports and snippets without imports", () => {
    const aliased =
      read(`import { pgTable as table, varchar as vc } from "drizzle-orm/pg-core";
export const t = table("t", { code: vc({ length: 12 }) });`);
    expect(aliased.diagram.tables[0]!.columns[0]!.type).toBe("varchar(12)");

    const snippet = read(`export const t = sqliteTable("t", {
  done: integer({ mode: "boolean" }).notNull(),
});`);
    expect(snippet.diagram.dialect).toBe("sqlite");
    expect(snippet.diagram.tables[0]!.columns[0]!.type).toBe("boolean");
  });

  test("builder options become the SQL type", () => {
    const types = (code: string, module = "pg-core", fn = "pgTable") =>
      read(
        `import * as p from "drizzle-orm/${module}";
export const t = p.${fn}("t", { ${code} });`,
      ).diagram.tables[0]!.columns.map((c) => c.type);
    expect(
      types(
        `a: p.numeric({ precision: 10, scale: 2 }), b: p.timestamp({ withTimezone: true, precision: 3 }), c: p.bigint({ mode: "bigint" }), d: p.text().array(), e: p.doublePrecision(), f: p.geometry({ type: "point" })`,
      ),
    ).toEqual([
      "numeric(10,2)",
      "timestamptz(3)",
      "bigint",
      "text[]",
      "double precision",
      "geometry",
    ]);
    expect(
      types(
        `a: p.integer({ mode: "timestamp" }), b: p.text({ mode: "json" }), c: p.text({ length: 20 }), d: p.integer()`,
        "sqlite-core",
        "sqliteTable",
      ),
    ).toEqual(["timestamp", "json", "varchar(20)", "integer"]);
  });

  test("defaults", () => {
    const value = (code: string) => columnOf(`a: ${code}`).column!.default;
    expect(value(`p.integer().default(-1)`)).toBe("-1");
    expect(value(`p.boolean().default(false)`)).toBe("false");
    expect(value(`p.text().default("it's")`)).toBe("'it''s'");
    expect(value("p.text().default(`plain`)")).toBe("'plain'");
    expect(value(`p.numeric().default("1.50")`)).toBe("1.50");
    expect(value("p.jsonb().default(sql`'{}'::jsonb`)")).toBe("'{}'::jsonb");
    expect(value(`p.timestamp().defaultNow()`)).toBe("now()");
    expect(value(`p.uuid().defaultRandom()`)).toBe("gen_random_uuid()");
    expect(value(`p.text().default(null)`)).toBe("null");

    const { column, warnings } = columnOf("a: p.text().default(sql`${x}`)");
    expect(column!.default).toBeUndefined();
    expect(warnings).toEqual([
      {
        message: `The default of "a" in "t" can't be read; it was skipped`,
        line: 3,
      },
    ]);
  });

  test("MySQL and SQLite enums", () => {
    const mysql =
      read(`import { mysqlEnum, mysqlTable } from "drizzle-orm/mysql-core";
/** Order state */
export const orderState = ["new", "paid"] as const;
export const orders = mysqlTable("orders", {
  state: mysqlEnum("state", orderState),
  kind: mysqlEnum(["a", "b"]),
});`);
    expect(mysql.diagram.enums.map((e) => [e.name, e.values, e.note])).toEqual([
      ["order_state", ["new", "paid"], "Order state"],
      ["orders_kind", ["a", "b"], undefined],
    ]);
    expect(mysql.diagram.tables[0]!.columns.map((c) => c.type)).toEqual([
      "order_state",
      "orders_kind",
    ]);

    const sqlite =
      read(`import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const t = sqliteTable("t", { mood: text({ enum: ["sad", "ok"] }) });`);
    expect(sqlite.diagram.enums.map((e) => e.name)).toEqual(["t_mood"]);
  });

  test("doc comments become comments; line comments are ignored", () => {
    const { diagram } =
      read(`import { pgTable, text } from "drizzle-orm/pg-core";
// not a comment of the table
/**
 * People
 * who write
 */
export const users = pgTable("users", {
  // nor of the column
  name: text(),
  /** Shown in lists */
  title: text(),
});`);
    const users = diagram.tables[0]!;
    expect(users.comment).toBe("People\nwho write");
    expect(users.columns.map((c) => c.comment)).toEqual([
      undefined,
      "Shown in lists",
    ]);
  });

  test("the third argument: keys, unique and the older object style", () => {
    const { diagram, warnings } =
      read(`import * as p from "drizzle-orm/pg-core";
export const t = p.pgTable("t", {
  a: p.integer(),
  b: p.integer(),
  c: p.text(),
}, (table) => ({
  pk: p.primaryKey(table.a, table.b),
  c: p.uniqueIndex("c_idx").on(table.c),
  ab: p.unique().on(table.a, table.b),
}));`);
    const t = diagram.tables[0]!;
    expect(t.columns.map((c) => [c.name, c.primaryKey, c.unique])).toEqual([
      ["a", true, false],
      ["b", true, false],
      ["c", false, true],
    ]);
    expect(warnings).toEqual([
      {
        message: `Unique constraint on several columns in "t" was ignored`,
        line: 9,
      },
    ]);
  });

  test("what needs running the code is skipped with a warning", () => {
    const { diagram, warnings } =
      read(`import { integer, pgTable } from "drizzle-orm/pg-core";
import { idColumn, shared } from "./columns";

export const t = pgTable("t", {
  id: idColumn(),
  ownerId: integer().references(() => owners.id, { onDelete: "set default" }),
  ...shared(),
});`);
    expect(diagram.tables[0]!.columns.map((c) => c.name)).toEqual(["ownerId"]);
    expect(diagram.relations).toEqual([]);
    expect(warnings).toEqual([
      {
        message: `Columns spread into "t" can't be read without running the code; they were skipped`,
        line: 7,
      },
      {
        message: `Column "id" in "t" was skipped: it can't be read without running the code`,
        line: 5,
      },
      {
        message: "SET DEFAULT is not supported; NO ACTION is used instead",
        line: 6,
      },
      {
        message: `Relation from "t" skipped: "owners" is not a table of this file`,
        line: 6,
      },
    ]);
  });

  test("broken code gives errors with their line", () => {
    const result = importSchema(
      `import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: integer().primaryKey(),
  name: text(.notNull(),
});

export const posts = pgTable("posts", {
  id: integer().primaryKey(),`,
    );
    expect(result).toEqual({
      ok: false,
      format: "drizzle",
      errors: [
        { message: `Unexpected "."`, line: 5 },
        { message: "Missing }", line: 9 },
      ],
    });
    expect(importSchema(`const t = pgTable("t`, "drizzle")).toEqual({
      ok: false,
      format: "drizzle",
      errors: [{ message: "Unclosed string", line: 1 }],
    });
  });

  test("tables come without a position", () => {
    const { diagram } = read(
      `export const t = pgTable("t", { id: integer() });`,
    );
    expect(diagram.layout.tables).toEqual({});
  });
});
