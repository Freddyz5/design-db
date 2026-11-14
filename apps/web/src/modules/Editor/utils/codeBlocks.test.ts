import { describe, expect, test } from "bun:test";
import { createExampleDiagram } from "@design-db/core";
import { locateTable, tableAtLine, tableBlocks } from "./codeBlocks";
import { generateCode } from "./codeFormats";

const SQL = `CREATE TYPE post_status AS ENUM ('draft', 'published');

CREATE TABLE users (
  id int PRIMARY KEY,
  "Email" varchar(255) NOT NULL DEFAULT 'a)b',
  name varchar(100) -- a comment with )
);

CREATE TABLE IF NOT EXISTS public."Posts" (
  id int,
  author_id int,
  PRIMARY KEY (id, author_id)
);

ALTER TABLE "Posts" ADD FOREIGN KEY (author_id) REFERENCES users (id);`;

const DBML = `Table users {
  id int [pk]
  email varchar
}

Table "posts_tags" [headercolor: #fff] {
  posts_id int
  indexes {
    (posts_id) [pk]
  }
}

Ref: posts_tags.posts_id > users.id`;

const DRIZZLE = `export const postsTags = pgTable("posts_tags", {
  postsId: integer("posts_id").notNull(),
}, (t) => [
  primaryKey({ columns: [t.postsId] }),
]);

export const users = pgTable("users", {
  createdAt: timestamp("created_at").defaultNow(),
});`;

describe("tableBlocks", () => {
  test("finds each table in SQL, from its header to its closing parenthesis", () => {
    expect(tableBlocks(SQL, "sql")).toEqual([
      { name: "users", start: 2, end: 6 },
      { name: "Posts", start: 8, end: 12 },
    ]);
  });

  test("in DBML, nested braces stay inside the table", () => {
    expect(tableBlocks(DBML, "dbml")).toEqual([
      { name: "users", start: 0, end: 3 },
      { name: "posts_tags", start: 5, end: 10 },
    ]);
  });

  test("in Drizzle, the table name is the one written to the database", () => {
    expect(tableBlocks(DRIZZLE, "drizzle")).toEqual([
      { name: "posts_tags", start: 0, end: 4 },
      { name: "users", start: 6, end: 8 },
    ]);
  });

  test("a table that never closes ends before the next one", () => {
    const code = "CREATE TABLE a (\n  id int,\nCREATE TABLE b (\n  id int\n);";
    expect(tableBlocks(code, "sql")).toEqual([
      { name: "a", start: 0, end: 1 },
      { name: "b", start: 2, end: 4 },
    ]);
  });

  test("finds every table of the example in the three formats", () => {
    const diagram = createExampleDiagram();
    const names = diagram.tables.map((table) => table.name);
    for (const format of ["sql", "dbml", "drizzle"] as const) {
      const code = generateCode(diagram, format);
      expect(tableBlocks(code, format).map((block) => block.name)).toEqual(
        names,
      );
    }
  });
});

describe("locateTable", () => {
  test("finds a table by its name, whatever the case", () => {
    expect(locateTable(SQL, "sql", "posts")).toEqual({
      start: 8,
      end: 12,
      line: 8,
    });
    expect(locateTable(SQL, "sql", "missing")).toBeNull();
  });

  test("puts the line on the column, quoted or not", () => {
    expect(locateTable(SQL, "sql", "users", "email")?.line).toBe(4);
    expect(locateTable(SQL, "sql", "users", "name")?.line).toBe(5);
    expect(locateTable(DBML, "dbml", "posts_tags", "posts_id")?.line).toBe(6);
  });

  test("in Drizzle, a column is found by its key", () => {
    expect(locateTable(DRIZZLE, "drizzle", "users", "created_at")?.line).toBe(
      7,
    );
  });

  test("a column that is not there leaves the line on the header", () => {
    expect(locateTable(SQL, "sql", "users", "nope")?.line).toBe(2);
  });
});

describe("tableAtLine", () => {
  test("the table whose block holds the line", () => {
    expect(tableAtLine(SQL, "sql", 4)).toBe("users");
    expect(tableAtLine(SQL, "sql", 12)).toBe("Posts");
    expect(tableAtLine(SQL, "sql", 0)).toBeNull();
    expect(tableAtLine(SQL, "sql", 14)).toBeNull();
  });
});
