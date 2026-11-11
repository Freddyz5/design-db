import { describe, expect, test } from "bun:test";
import { createTable } from "./factories";
import { apply, OperationError } from "./operations";
import { blogDiagram, deepFreeze } from "./test-utils";

describe("table.add", () => {
  test("adds the table at the end with its position", () => {
    const doc = deepFreeze(blogDiagram());
    const tags = createTable({ id: "tags", name: "tags" });
    const next = apply(doc, {
      type: "table.add",
      table: tags,
      position: { x: 10, y: 20 },
    });
    expect(next.tables.map((t) => t.id)).toEqual(["users", "posts", "tags"]);
    expect(next.layout.tables.tags).toEqual({ x: 10, y: 20 });
  });

  test("uses 0,0 when no position is given", () => {
    const next = apply(blogDiagram(), {
      type: "table.add",
      table: createTable({ id: "tags" }),
    });
    expect(next.layout.tables.tags).toEqual({ x: 0, y: 0 });
  });

  test("fails if the id is already used", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "table.add",
        table: createTable({ id: "users" }),
      }),
    ).toThrow(OperationError);
  });
});

describe("table.update", () => {
  test("renames a table and keeps the rest", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "table.update",
      tableId: "users",
      patch: { name: "accounts" },
    });
    expect(next.tables[0]).toEqual({ ...doc.tables[0]!, name: "accounts" });
    expect(next.tables[1]).toBe(doc.tables[1]!);
    expect(next.relations).toBe(doc.relations);
  });

  test("sets and removes the comment", () => {
    const withComment = apply(blogDiagram(), {
      type: "table.update",
      tableId: "users",
      patch: { comment: "People" },
    });
    expect(withComment.tables[0]!.comment).toBe("People");

    const without = apply(withComment, {
      type: "table.update",
      tableId: "users",
      patch: { comment: undefined },
    });
    expect("comment" in without.tables[0]!).toBe(false);
  });

  test("stores the color in the layout", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "table.update",
      tableId: "users",
      patch: { color: "red" },
    });
    expect(next.layout.tables.users).toEqual({ x: 0, y: 0, color: "red" });
    expect("color" in next.tables[0]!).toBe(false);

    const cleared = apply(next, {
      type: "table.update",
      tableId: "users",
      patch: { color: undefined },
    });
    expect(cleared.layout.tables.users).toEqual({ x: 0, y: 0 });
  });

  test("ignores undefined on required fields", () => {
    const next = apply(blogDiagram(), {
      type: "table.update",
      tableId: "users",
      patch: { name: undefined },
    });
    expect(next.tables[0]!.name).toBe("users");
  });

  test("fails if the table does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "table.update",
        tableId: "nope",
        patch: { name: "x" },
      }),
    ).toThrow(OperationError);
  });
});

describe("table.move", () => {
  test("changes the position and keeps the color", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "table.move",
      tableId: "posts",
      position: { x: 50, y: 60 },
    });
    expect(next.layout.tables.posts).toEqual({ x: 50, y: 60, color: "blue" });
    expect(next.tables).toBe(doc.tables);
  });

  test("creates the layout entry if it was missing", () => {
    const doc = blogDiagram();
    delete doc.layout.tables.users;
    const next = apply(doc, {
      type: "table.move",
      tableId: "users",
      position: { x: 1, y: 2 },
    });
    expect(next.layout.tables.users).toEqual({ x: 1, y: 2 });
  });

  test("fails if the table does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "table.move",
        tableId: "nope",
        position: { x: 0, y: 0 },
      }),
    ).toThrow(OperationError);
  });
});

describe("table.remove", () => {
  test("removes the table, its relations and its layout", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, { type: "table.remove", tableId: "users" });
    expect(next.tables.map((t) => t.id)).toEqual(["posts"]);
    expect(next.relations).toEqual([]);
    expect(next.layout.tables).toEqual({
      posts: { x: 300, y: 0, color: "blue" },
    });
  });

  test("removing the child table also removes the relation", () => {
    const next = apply(blogDiagram(), {
      type: "table.remove",
      tableId: "posts",
    });
    expect(next.relations).toEqual([]);
  });

  test("fails if the table does not exist", () => {
    expect(() =>
      apply(blogDiagram(), { type: "table.remove", tableId: "nope" }),
    ).toThrow(OperationError);
  });
});
