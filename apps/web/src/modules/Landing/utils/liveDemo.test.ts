import { describe, expect, test } from "bun:test";
import { DEMO_SQL, readDemo } from "./liveDemo";

describe("readDemo", () => {
  test("the starting SQL gives two tables, with keys and the reference", () => {
    const result = readDemo(DEMO_SQL);
    if (!result.ok) throw new Error(result.message);
    expect(result.tables.map((t) => t.name)).toEqual(["users", "posts"]);
    expect(result.tables[0]!.rows).toEqual([
      { name: "id", type: "int", detail: "PK", key: true },
      { name: "email", type: "varchar(255)", detail: "UQ", key: false },
      { name: "name", type: "varchar(100)", detail: "NULL", key: false },
    ]);
    expect(result.tables[1]!.rows[1]!.detail).toBe("→ users.id");
  });

  test("writes the same schema as DBML and Drizzle", () => {
    const result = readDemo(DEMO_SQL);
    if (!result.ok) throw new Error(result.message);
    expect(result.dbml).toContain("Table users {");
    expect(result.dbml).toContain("Ref: posts.author_id > users.id");
    expect(result.drizzle).toContain('pgTable("posts"');
  });

  test("an error says its line", () => {
    const result = readDemo("CREATE TABLE (");
    expect(result).toMatchObject({ ok: false, line: 1 });
  });
});
