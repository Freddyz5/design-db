import { describe, expect, test } from "bun:test";
import { createExampleDiagram, toDbml } from "@design-db/core";
import { tokenizeDbml } from "./dbmlLanguage";

/** The pieces highlighted as `style`, in order. */
const styled = (text: string, style: string | null) =>
  tokenizeDbml(text)
    .filter(([, found]) => found === style)
    .map(([piece]) => piece);

describe("DBML language", () => {
  test("a table: keyword, column names plain, types highlighted", () => {
    const text = `Table users {
  id int [pk, increment]
  email varchar(255) [unique, not null, note: 'Login']
  "full name" text
}`;
    expect(styled(text, "keyword")).toEqual([
      "Table",
      "pk",
      "increment",
      "unique",
      "not",
      "note",
    ]);
    expect(styled(text, "typeName")).toEqual(["int", "varchar", "text"]);
    expect(styled(text, "atom")).toEqual(["null"]);
    expect(styled(text, "string")).toEqual(["'Login'"]);
    expect(styled(text, "number")).toEqual(["255"]);
    // Column names and the table name are plain text.
    expect(styled(text, null)).toEqual(["users", "id", "email", '"full name"']);
  });

  test("notes: one line, several lines and inside a table", () => {
    const text = `Table users {
  id int
  Note: '''People who can
sign in'''
}
Note sticky {
  'remember'
}`;
    expect(styled(text, "keyword")).toEqual(["Table", "Note", "Note"]);
    expect(styled(text, "string")).toEqual([
      "'''People who can",
      "sign in'''",
      "'remember'",
    ]);
    // After the note, the next table line is read as column and type again.
    expect(styled("Table a {\n  Note: 'x'\n  id int\n}", "typeName")).toEqual([
      "int",
    ]);
  });

  test("comments: line and block", () => {
    const text = `// users of the app
Table users { /* the
  key */ id int
}`;
    expect(styled(text, "comment")).toEqual([
      "// users of the app",
      "/* the",
      "  key */",
    ]);
    expect(styled(text, "typeName")).toEqual(["int"]);
  });

  test("Ref, with its operator and its actions", () => {
    const text =
      "Ref: posts.author_id > users.id [delete: cascade, update: set null]";
    expect(styled(text, "keyword")).toEqual(["Ref", "delete", "update"]);
    expect(styled(text, "operator")).toEqual([">"]);
    expect(styled(text, "atom")).toEqual(["cascade", "set", "null"]);
    // The tables and columns of a Ref are not types.
    expect(styled(text, "typeName")).toEqual([]);
  });

  test("Enum and TableGroup", () => {
    const text = `Enum post_status {
  draft
  published
}
TableGroup Content [color: #21694a] {
  posts
  comments
}`;
    expect(styled(text, "keyword")).toEqual(["Enum", "TableGroup", "color"]);
    expect(styled(text, "atom")).toEqual(["#21694a"]);
    expect(styled(text, "typeName")).toEqual([]);
  });

  test("Project properties, defaults and indexes", () => {
    const text = `Project Blog {
  database_type: 'PostgreSQL'
}
Table posts_tags {
  created_at timestamp [default: \`now()\`]
  indexes {
    (posts_id, tags_id) [pk]
  }
}`;
    expect(styled(text, "keyword")).toEqual([
      "Project",
      "Table",
      "default",
      "indexes",
      "pk",
    ]);
    expect(styled(text, "propertyName")).toEqual(["database_type"]);
    expect(styled(text, "string")).toEqual(["'PostgreSQL'", "`now()`"]);
    expect(styled(text, "typeName")).toEqual(["timestamp"]);
  });

  test("the DBML the core writes for the example diagram", () => {
    const text = toDbml(createExampleDiagram());
    expect(styled(text, "keyword").filter((k) => /^[A-Z]/.test(k))).toEqual([
      "Project",
      "Enum",
      "Table",
      "Table",
      "Table",
      "Table",
      "Table",
      "Ref",
      "Ref",
      "Ref",
      "Ref",
      "Ref",
      "TableGroup",
      "TableGroup",
    ]);
    expect(new Set(styled(text, "typeName"))).toEqual(
      new Set(["int", "varchar", "timestamp", "post_status", "text"]),
    );
  });
});
