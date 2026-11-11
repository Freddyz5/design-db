import { describe, expect, test } from "bun:test";
import {
  applyAll,
  createExampleDiagram,
  mergeDiagram,
  validate,
  type Diagram,
} from "../../Diagrams";
import { toDbml } from "./DbmlExport";
import { sampleDiagram } from "./FormatFixtures";
import { detectFormat, importSchema } from "./SchemaImport";
import { toSql } from "./SqlExport";

/** The schema by names, to compare diagrams with different ids. */
function shape(doc: Diagram) {
  const tableName = (id: string) => doc.tables.find((t) => t.id === id)!.name;
  const columnName = (tableId: string, id: string) =>
    doc.tables.find((t) => t.id === tableId)!.columns.find((c) => c.id === id)!
      .name;
  return {
    tables: doc.tables.map((t) => ({
      name: t.name,
      comment: t.comment,
      columns: t.columns.map((c) => [
        c.name,
        c.primaryKey,
        c.nullable,
        c.unique,
        c.autoIncrement,
        c.comment,
      ]),
    })),
    relations: doc.relations.map((r) => [
      tableName(r.from.tableId),
      r.from.columnIds.map((id) => columnName(r.from.tableId, id)),
      tableName(r.to.tableId),
      r.to.columnIds.map((id) => columnName(r.to.tableId, id)),
      r.onDelete,
    ]),
    enums: doc.enums.map((e) => [e.name, e.values]),
  };
}

describe("detectFormat", () => {
  test("tells SQL, DBML and JSON apart", () => {
    expect(detectFormat("CREATE TABLE t (id int);")).toBe("sql");
    expect(detectFormat("Table t {\n id int\n}")).toBe("dbml");
    expect(detectFormat("Ref: a.b > c.d")).toBe("dbml");
    expect(detectFormat('  {"version": 1}')).toBe("json");
  });
});

describe("importSchema", () => {
  test("round trip through PostgreSQL keeps the schema", () => {
    const original = sampleDiagram();
    const result = importSchema(toSql(original, "postgres"));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.format).toBe("sql");
    expect(shape(result.diagram)).toEqual(shape(original));
  });

  test("round trip through DBML keeps the schema and the groups", () => {
    const original = sampleDiagram();
    const result = importSchema(toDbml(original));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(shape(result.diagram)).toEqual(shape(original));
    expect(result.diagram.dialect).toBe("postgres");
    expect(result.diagram.groups.map((g) => [g.name, g.color])).toEqual([
      ["accounts", "#2c5f8e"],
    ]);
    const users = result.diagram.tables.find((t) => t.name === "users")!;
    expect(users.groupId).toBe(result.diagram.groups[0]!.id);
  });

  test("round trip of the example through MySQL has no issues", () => {
    const result = importSchema(toSql(createExampleDiagram(), "mysql"));
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.diagram.dialect).toBe("mysql");
    expect(result.diagram.tables).toHaveLength(5);
    expect(validate(result.diagram)).toEqual([]);
  });

  test("imported tables have no position", () => {
    const result = importSchema("CREATE TABLE t (id int);");
    expect(result.ok && result.diagram.layout.tables).toEqual({});
  });

  test("JSON is read as the project's own format", () => {
    const original = createExampleDiagram();
    const result = importSchema(JSON.stringify(original));
    expect(result).toEqual({
      ok: true,
      format: "json",
      diagram: original,
      warnings: [],
    });
  });

  test("invalid JSON and invalid projects are errors", () => {
    const broken = importSchema('{\n  "version": 1,\n  oops\n}');
    expect(broken.ok).toBe(false);
    expect(importSchema('{"version": 2}').ok).toBe(false);
  });

  test("an empty text gives an empty diagram", () => {
    const result = importSchema("  \n ");
    expect(result.ok && result.diagram.tables).toEqual([]);
  });

  test("errors keep the format and the line", () => {
    expect(importSchema("CREATE TABLE a (\n id int")).toEqual({
      ok: false,
      format: "sql",
      errors: [{ message: "Missing )", line: 2 }],
    });
  });
});

describe("editing the code of a diagram", () => {
  test("replacing with the edited SQL keeps positions, ids and groups", () => {
    const doc = applyAll(sampleDiagram(), [
      { type: "table.move", tableId: "posts", position: { x: 400, y: 120 } },
    ]);
    const edited = toSql(doc, "postgres").replace(
      "title text",
      "headline text",
    );
    const result = importSchema(edited);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));

    const next = mergeDiagram(doc, result.diagram, "replace");
    const posts = next.tables.find((t) => t.name === "posts")!;
    expect(posts.id).toBe("posts");
    expect(posts.columns.map((c) => c.name)).toContain("headline");
    expect(next.layout.tables.posts).toEqual({ x: 400, y: 120 });
    expect(next.groups).toEqual(doc.groups);
    expect(next.tables.find((t) => t.name === "users")!.groupId).toBe(
      "accounts",
    );
    expect(next.relations[0]!.id).toBe("posts_user");
  });
});
