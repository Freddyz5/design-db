import { describe, expect, test } from "bun:test";
import {
  apply,
  createColumn,
  createDiagram,
  createGroup,
  createRelation,
  createTable,
  type Diagram,
} from "@design-db/core";
import {
  columnReference,
  columnRules,
  enumValues,
  noteHeight,
} from "./tableCard";

describe("columnRules", () => {
  const table = createTable({
    columns: [
      createColumn({
        id: "id",
        primaryKey: true,
        unique: true,
        autoIncrement: true,
        type: "int",
      }),
      createColumn({ id: "email", nullable: false, unique: true }),
      createColumn({ id: "name" }),
      createColumn({ id: "created", nullable: false, default: "now()" }),
      createColumn({ id: "serial", type: "serial", autoIncrement: true }),
    ],
  });
  const rules = (id: string) =>
    columnRules(
      table.columns.find((c) => c.id === id)!,
      table,
    );

  test("a primary key says PK, the rest whether they can be empty", () => {
    expect(rules("id")).toBe("PK, identity");
    expect(rules("name")).toBe("null");
  });

  test("lists unique and the default", () => {
    expect(rules("email")).toBe("not null, unique");
    expect(rules("created")).toBe("not null, default now()");
  });

  test("a serial type needs no identity", () => {
    expect(rules("serial")).toBe("null");
  });

  test("a column of a composite key keeps its unique", () => {
    const pair = createTable({
      columns: [
        createColumn({ id: "a", primaryKey: true, unique: true }),
        createColumn({ id: "b", primaryKey: true }),
      ],
    });
    expect(columnRules(pair.columns[0]!, pair)).toBe("PK, unique");
  });
});

/** users in "Accounts"; posts and tags in "Content"; posts → users, tags → posts. */
function grouped(): Diagram {
  let diagram = createDiagram();
  for (const op of [
    {
      type: "group.add",
      group: createGroup({ id: "accounts", name: "Accounts" }),
    },
    {
      type: "group.add",
      group: createGroup({ id: "content", name: "Content" }),
    },
    {
      type: "table.add",
      table: createTable({
        id: "users",
        name: "users",
        groupId: "accounts",
        columns: [
          createColumn({ id: "users.id", name: "id", primaryKey: true }),
        ],
      }),
    },
    {
      type: "table.add",
      table: createTable({
        id: "posts",
        name: "posts",
        groupId: "content",
        columns: [
          createColumn({ id: "posts.id", name: "id", primaryKey: true }),
          createColumn({ id: "posts.author", name: "author_id" }),
        ],
      }),
    },
    {
      type: "table.add",
      table: createTable({
        id: "tags",
        name: "tags",
        groupId: "content",
        columns: [createColumn({ id: "tags.post", name: "post_id" })],
      }),
    },
    {
      type: "relation.add",
      relation: createRelation({
        from: { tableId: "posts", columnIds: ["posts.author"] },
        to: { tableId: "users", columnIds: ["users.id"] },
      }),
    },
    {
      type: "relation.add",
      relation: createRelation({
        from: { tableId: "tags", columnIds: ["tags.post"] },
        to: { tableId: "posts", columnIds: ["posts.id"] },
      }),
    },
  ] as const) {
    diagram = apply(diagram, op);
  }
  return diagram;
}

describe("columnReference", () => {
  const diagram = grouped();
  const table = (id: string) => diagram.tables.find((t) => t.id === id)!;

  test("a key to another group carries that group's number", () => {
    const posts = table("posts");
    expect(columnReference(diagram, posts, posts.columns[1]!)).toEqual({
      table: "users",
      column: "id",
      group: 1,
    });
  });

  test("a key inside the group has no number", () => {
    const tags = table("tags");
    expect(columnReference(diagram, tags, tags.columns[0]!)?.group).toBeNull();
  });

  test("a column that is not a key points nowhere", () => {
    const posts = table("posts");
    expect(columnReference(diagram, posts, posts.columns[0]!)).toBeNull();
  });
});

describe("enumValues", () => {
  test("finds the enum a type names, whatever its case", () => {
    const diagram = apply(createDiagram(), {
      type: "enum.add",
      enum: { id: "s", name: "post_status", values: ["draft", "published"] },
    });
    expect(enumValues(diagram, "Post_Status")).toEqual(["draft", "published"]);
    expect(enumValues(diagram, "text")).toBeNull();
  });
});

describe("noteHeight", () => {
  test("no note takes no room; a long one wraps", () => {
    expect(noteHeight(null)).toBe(0);
    expect(noteHeight("Short")).toBe(6 + 16);
    expect(noteHeight("x".repeat(120))).toBe(6 + 3 * 16);
    expect(noteHeight("one\ntwo")).toBe(6 + 2 * 16);
  });
});
