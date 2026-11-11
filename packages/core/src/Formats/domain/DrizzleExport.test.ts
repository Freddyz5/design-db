import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { apply, applyAll, createDiagram, type Diagram } from "../../Diagrams";
import { createRelation } from "../../Relations";
import { createTable } from "../../Tables";
import { toDrizzle } from "./DrizzleExport";
import { sampleDiagram } from "./FormatFixtures";

/** A diagram with one table `t` and the given columns. */
function oneTable(
  columns: Parameters<typeof createColumn>[0][],
  dialect: Diagram["dialect"] = "postgres",
): Diagram {
  return apply(createDiagram({ dialect }), {
    type: "table.add",
    table: createTable({
      id: "t",
      name: "t",
      columns: columns.map(createColumn),
    }),
  });
}

describe("toDrizzle", () => {
  test("PostgreSQL", () => {
    expect(toDrizzle(sampleDiagram(), "postgres")).toBe(
      `import { integer, pgEnum, pgTable, text, varchar } from "drizzle-orm/pg-core";

export const postStatus = pgEnum("post_status", ["draft", "published"]);

/** People who write */
export const users = pgTable("users", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  email: varchar({ length: 255 }).notNull().unique(),
});

export const posts = pgTable("posts", {
  id: integer().primaryKey().generatedByDefaultAsIdentity(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: postStatus().notNull().default("draft"),
  order: integer(),
  /** Shown in lists */
  title: text(),
});
`,
    );
  });

  test("MySQL", () => {
    const code = toDrizzle(sampleDiagram(), "mysql");
    expect(code).toContain(`} from "drizzle-orm/mysql-core";`);
    expect(code).toContain(
      `export const postStatus = ["draft", "published"] as const;`,
    );
    expect(code).toContain(
      `  status: mysqlEnum("status", postStatus).notNull().default("draft"),`,
    );
    expect(code).toContain(`  id: int().primaryKey().autoincrement(),`);
    expect(code).toContain(`export const users = mysqlTable("users", {`);
  });

  test("SQLite", () => {
    const code = toDrizzle(sampleDiagram(), "sqlite");
    expect(code).toContain(`} from "drizzle-orm/sqlite-core";`);
    expect(code).toContain(
      `  status: text({ enum: postStatus }).notNull().default("draft"),`,
    );
    expect(code).toContain(
      `  id: integer().primaryKey({ autoIncrement: true }),`,
    );
    expect(code).toContain(
      `  email: text({ length: 255 }).notNull().unique(),`,
    );
  });

  test("generic uses PostgreSQL and the diagram's dialect is the default", () => {
    const doc = { ...sampleDiagram(), dialect: "generic" as const };
    expect(toDrizzle(doc)).toBe(toDrizzle(sampleDiagram(), "postgres"));
    expect(toDrizzle(sampleDiagram())).toBe(
      toDrizzle(sampleDiagram(), "postgres"),
    );
  });

  test("composite keys and named relations go in the third argument", () => {
    const doc = applyAll(createDiagram({ dialect: "postgres" }), [
      {
        type: "table.add",
        table: createTable({
          id: "owners",
          name: "owners",
          columns: [
            createColumn({
              id: "o.a",
              name: "a",
              type: "int",
              primaryKey: true,
            }),
            createColumn({
              id: "o.b",
              name: "b",
              type: "int",
              primaryKey: true,
            }),
          ],
        }),
      },
      {
        type: "table.add",
        table: createTable({
          id: "links",
          name: "links",
          columns: [
            createColumn({ id: "l.a", name: "owner_a", type: "int" }),
            createColumn({ id: "l.b", name: "owner_b", type: "int" }),
          ],
        }),
      },
      {
        type: "relation.add",
        relation: createRelation({
          name: "fk_owner",
          from: { tableId: "links", columnIds: ["l.a", "l.b"] },
          to: { tableId: "owners", columnIds: ["o.a", "o.b"] },
          onDelete: "cascade",
          onUpdate: "restrict",
        }),
      },
    ]);
    const code = toDrizzle(doc);
    expect(code).toContain(`export const owners = pgTable("owners", {
  a: integer().notNull(),
  b: integer().notNull(),
}, (t) => [
  primaryKey({ columns: [t.a, t.b] }),
]);`);
    expect(code).toContain(
      `  foreignKey({ name: "fk_owner", columns: [t.ownerA, t.ownerB], foreignColumns: [owners.a, owners.b] }).onDelete("cascade").onUpdate("restrict"),`,
    );
  });

  test("references to the same or a later table are annotated", () => {
    const doc = applyAll(createDiagram({ dialect: "mysql" }), [
      {
        type: "table.add",
        table: createTable({
          id: "cat",
          name: "categories",
          columns: [
            createColumn({
              id: "c.id",
              name: "id",
              type: "int",
              primaryKey: true,
            }),
            createColumn({ id: "c.parent", name: "parent_id", type: "int" }),
            createColumn({ id: "c.owner", name: "owner_id", type: "int" }),
          ],
        }),
      },
      {
        type: "table.add",
        table: createTable({
          id: "own",
          name: "owners",
          columns: [
            createColumn({
              id: "w.id",
              name: "id",
              type: "int",
              primaryKey: true,
            }),
          ],
        }),
      },
      {
        type: "relation.add",
        relation: createRelation({
          from: { tableId: "cat", columnIds: ["c.parent"] },
          to: { tableId: "cat", columnIds: ["c.id"] },
        }),
      },
      {
        type: "relation.add",
        relation: createRelation({
          from: { tableId: "cat", columnIds: ["c.owner"] },
          to: { tableId: "own", columnIds: ["w.id"] },
        }),
      },
    ]);
    const code = toDrizzle(doc);
    expect(code).toContain("import { type AnyMySqlColumn, int, mysqlTable }");
    expect(code).toContain(
      `  parentId: int("parent_id").references((): AnyMySqlColumn => categories.id),`,
    );
    expect(code).toContain(
      `  ownerId: int("owner_id").references((): AnyMySqlColumn => owners.id),`,
    );
  });

  test("types without a builder are declared with customType", () => {
    const code = toDrizzle(
      oneTable([
        { name: "a", type: "geometry(point,4326)" },
        { name: "b", type: "geometry(point,4326)" },
        { name: "c", type: "citext" },
      ]),
    );
    expect(code).toContain(
      `const geometry = customType<{ data: string }>({ dataType: () => "geometry(point,4326)" });`,
    );
    expect(code).toContain(
      `const citext = customType<{ data: string }>({ dataType: () => "citext" });`,
    );
    expect(code).toContain(`  a: geometry("a"),\n  b: geometry("b"),\n`);
    expect(code.match(/const geometry/g)).toHaveLength(1);
  });

  test("builder options, aliases and arrays", () => {
    const code = toDrizzle(
      oneTable([
        { name: "a", type: "numeric(10, 2)" },
        { name: "b", type: "timestamp with time zone" },
        { name: "c", type: "int8" },
        { name: "d", type: "text[]" },
        { name: "e", type: "double precision" },
      ]),
    );
    expect(code).toContain(`  a: numeric({ precision: 10, scale: 2 }),`);
    expect(code).toContain(`  b: timestamp({ withTimezone: true }),`);
    expect(code).toContain(`  c: bigint({ mode: "number" }),`);
    expect(code).toContain(`  d: text().array(),`);
    expect(code).toContain(`  e: doublePrecision(),`);
  });

  test("defaults", () => {
    const code = toDrizzle(
      oneTable([
        { name: "a", type: "integer", default: "0" },
        { name: "b", type: "numeric", default: "1.5" },
        { name: "c", type: "boolean", default: "TRUE" },
        { name: "d", type: "text", default: "'it''s'" },
        { name: "e", type: "timestamp", default: "now()" },
        { name: "f", type: "uuid", default: "gen_random_uuid()" },
        { name: "g", type: "jsonb", default: "'{}'::jsonb" },
        { name: "h", type: "text", default: "concat('`', '${x}')" },
      ]),
    );
    expect(code).toContain(`import { sql } from "drizzle-orm";\n`);
    expect(code).toContain(`  a: integer().default(0),`);
    expect(code).toContain(`  b: numeric().default("1.5"),`);
    expect(code).toContain(`  c: boolean().default(true),`);
    expect(code).toContain(`  d: text().default("it's"),`);
    expect(code).toContain(`  e: timestamp().defaultNow(),`);
    expect(code).toContain(`  f: uuid().defaultRandom(),`);
    expect(code).toContain("  g: jsonb().default(sql`'{}'::jsonb`),");
    expect(code).toContain(
      "  h: text().default(sql`concat('\\`', '\\${x}')`),",
    );
  });

  test("SQLite booleans take true and false", () => {
    const code = toDrizzle(
      oneTable([{ name: "a", type: "boolean", default: "1" }], "sqlite"),
    );
    expect(code).toContain(`  a: integer({ mode: "boolean" }).default(true),`);
  });

  test("names become variables without clashing", () => {
    const doc = applyAll(createDiagram({ dialect: "postgres" }), [
      {
        type: "table.add",
        table: createTable({
          name: "text",
          columns: [
            createColumn({ name: "First Name", type: "text" }),
            createColumn({ name: "first_name", type: "text" }),
            createColumn({ name: "ID", type: "int" }),
          ],
        }),
      },
      {
        type: "table.add",
        table: createTable({ name: "2024 sales", columns: [] }),
      },
      {
        type: "table.add",
        table: createTable({ name: "default", columns: [] }),
      },
    ]);
    const code = toDrizzle(doc);
    expect(code).toContain(`export const textTable = pgTable("text", {
  firstName: text("First Name"),
  firstName2: text("first_name"),
  id: integer("ID"),
});`);
    expect(code).toContain(
      `export const _2024Sales = pgTable("2024 sales", {});`,
    );
    expect(code).toContain(
      `export const defaultTable = pgTable("default", {});`,
    );
  });

  test("comments on several lines and with */", () => {
    const doc = apply(createDiagram(), {
      type: "table.add",
      table: createTable({
        name: "t",
        comment: "First\nends with */ here",
        columns: [],
      }),
    });
    expect(toDrizzle(doc)).toContain(
      `/**\n * First\n * ends with *\\/ here\n */\nexport const tTable = pgTable("t", {});`,
    );
  });

  test("skips relations that point at something missing", () => {
    const doc = sampleDiagram();
    const broken = {
      ...doc,
      relations: [
        { ...doc.relations[0]!, to: { tableId: "gone", columnIds: ["x"] } },
      ],
    };
    expect(toDrizzle(broken)).not.toContain("references");
  });

  test("an empty diagram gives an empty string", () => {
    expect(toDrizzle(createDiagram())).toBe("");
  });
});
