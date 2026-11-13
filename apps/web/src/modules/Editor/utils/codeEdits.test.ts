import { describe, expect, test } from "bun:test";
import { createExampleDiagram } from "@design-db/core";
import { applyCode, sameSchema } from "./codeEdits";
import { CODE_FORMATS, generateCode } from "./codeFormats";

const example = createExampleDiagram();

describe("applyCode", () => {
  test.each([...CODE_FORMATS])(
    "the code of the diagram changes nothing (%s)",
    (format) => {
      const result = applyCode(example, generateCode(example, format), format);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.diagram).toBe(example);
        expect(result.unplaced).toEqual([]);
      }
    },
  );

  test("renaming a table in the SQL keeps its id, position and group", () => {
    const users = example.tables.find((t) => t.name === "users")!;
    const sql = generateCode(example, "sql")
      .replace("CREATE TABLE users (", "CREATE TABLE people (")
      .replaceAll("REFERENCES users ", "REFERENCES people ");
    const result = applyCode(example, sql, "sql");
    if (!result.ok) throw new Error(result.errors[0]?.message);

    // A renamed table is a new name: it is matched by name, so it is a new table.
    const people = result.diagram.tables.find((t) => t.name === "people")!;
    expect(result.diagram.tables.some((t) => t.name === "users")).toBe(false);
    expect(result.unplaced).toEqual([people.id]);
    expect(people.id).not.toBe(users.id);
  });

  test("a new column keeps the table where it was", () => {
    const posts = example.tables.find((t) => t.name === "posts")!;
    const sql = generateCode(example, "sql").replace(
      "  published_at timestamp\n",
      "  published_at timestamp,\n  views int NOT NULL DEFAULT 0\n",
    );
    const result = applyCode(example, sql, "sql");
    if (!result.ok) throw new Error(result.errors[0]?.message);

    const next = result.diagram.tables.find((t) => t.id === posts.id)!;
    expect(next.columns.map((c) => c.name)).toContain("views");
    expect(result.diagram.layout.tables[posts.id]).toEqual(
      example.layout.tables[posts.id],
    );
    expect(next.groupId).toBe(posts.groupId);
    expect(result.unplaced).toEqual([]);
  });

  test("a new table in the DBML has no position yet", () => {
    const dbml = `${generateCode(example, "dbml")}\n\nTable likes {\n  id int [pk]\n}\n`;
    const result = applyCode(example, dbml, "dbml");
    if (!result.ok) throw new Error(result.errors[0]?.message);
    const likes = result.diagram.tables.find((t) => t.name === "likes")!;
    expect(result.unplaced).toEqual([likes.id]);
  });

  test("code with errors leaves the diagram alone and says on which line", () => {
    const result = applyCode(
      example,
      "CREATE TABLE users (\n  id int,\n",
      "sql",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]!.line).toBeGreaterThan(0);
    }
  });

  test("keeps the name and the dialect of the diagram", () => {
    const result = applyCode(
      example,
      "CREATE TABLE a (id int PRIMARY KEY);",
      "sql",
    );
    if (!result.ok) throw new Error(result.errors[0]?.message);
    expect(result.diagram.name).toBe(example.name);
    expect(result.diagram.dialect).toBe(example.dialect);
  });
});

describe("sameSchema", () => {
  test("ignores the order of the keys", () => {
    const shuffled = {
      ...example,
      tables: example.tables.map((table) => {
        const { columns, ...rest } = table;
        return { columns, ...rest };
      }),
    };
    expect(sameSchema(example, shuffled)).toBe(true);
  });

  test("sees a change of position", () => {
    const [first] = example.tables;
    const moved = {
      ...example,
      layout: {
        ...example.layout,
        tables: { ...example.layout.tables, [first!.id]: { x: 1, y: 1 } },
      },
    };
    expect(sameSchema(example, moved)).toBe(false);
  });
});
