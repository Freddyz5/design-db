import { describe, expect, test } from "bun:test";
import { createColumn } from "./factories";
import { apply, OperationError } from "./operations";
import type { Diagram } from "./schema";
import { blogDiagram, deepFreeze } from "./test-utils";

const columnNames = (doc: Diagram, tableId: string) =>
  doc.tables.find((t) => t.id === tableId)!.columns.map((c) => c.name);

describe("column.add", () => {
  test("adds the column at the end by default", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "column.add",
      tableId: "users",
      column: createColumn({ name: "name" }),
    });
    expect(columnNames(next, "users")).toEqual(["id", "email", "name"]);
    expect(next.tables[1]).toBe(doc.tables[1]!);
  });

  test("adds the column at the given index", () => {
    const next = apply(blogDiagram(), {
      type: "column.add",
      tableId: "users",
      column: createColumn({ name: "name" }),
      index: 1,
    });
    expect(columnNames(next, "users")).toEqual(["id", "name", "email"]);
  });

  test("clamps an out-of-range index", () => {
    const first = apply(blogDiagram(), {
      type: "column.add",
      tableId: "users",
      column: createColumn({ name: "a" }),
      index: -5,
    });
    expect(columnNames(first, "users")[0]).toBe("a");

    const last = apply(blogDiagram(), {
      type: "column.add",
      tableId: "users",
      column: createColumn({ name: "z" }),
      index: 99,
    });
    expect(columnNames(last, "users").at(-1)).toBe("z");
  });

  test("fails if the column id is already in the table", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "column.add",
        tableId: "users",
        column: createColumn({ id: "users.id" }),
      }),
    ).toThrow(OperationError);
  });

  test("fails if the table does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "column.add",
        tableId: "nope",
        column: createColumn(),
      }),
    ).toThrow(OperationError);
  });
});

describe("column.update", () => {
  test("changes only the given fields", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "column.update",
      tableId: "users",
      columnId: "users.email",
      patch: { unique: true, nullable: false },
    });
    expect(next.tables[0]!.columns[1]).toEqual({
      ...doc.tables[0]!.columns[1]!,
      unique: true,
      nullable: false,
    });
    expect(next.tables[0]!.columns[0]).toBe(doc.tables[0]!.columns[0]!);
  });

  test("sets and removes the default value", () => {
    const withDefault = apply(blogDiagram(), {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.title",
      patch: { default: "''" },
    });
    expect(withDefault.tables[1]!.columns[2]!.default).toBe("''");

    const without = apply(withDefault, {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.title",
      patch: { default: undefined },
    });
    expect("default" in without.tables[1]!.columns[2]!).toBe(false);
  });

  test("keeps the relations", () => {
    const doc = blogDiagram();
    const next = apply(doc, {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.user_id",
      patch: { name: "author_id" },
    });
    expect(next.relations).toEqual(doc.relations);
  });

  test("fails if the column does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "column.update",
        tableId: "users",
        columnId: "nope",
        patch: { name: "x" },
      }),
    ).toThrow(OperationError);
  });
});

describe("column.move", () => {
  test("moves a column down", () => {
    const next = apply(deepFreeze(blogDiagram()), {
      type: "column.move",
      tableId: "posts",
      columnId: "posts.id",
      index: 2,
    });
    expect(columnNames(next, "posts")).toEqual(["user_id", "title", "id"]);
  });

  test("moves a column up", () => {
    const next = apply(blogDiagram(), {
      type: "column.move",
      tableId: "posts",
      columnId: "posts.title",
      index: 0,
    });
    expect(columnNames(next, "posts")).toEqual(["title", "id", "user_id"]);
  });

  test("clamps an out-of-range index", () => {
    const next = apply(blogDiagram(), {
      type: "column.move",
      tableId: "posts",
      columnId: "posts.id",
      index: 99,
    });
    expect(columnNames(next, "posts")).toEqual(["user_id", "title", "id"]);
  });

  test("fails if the column does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "column.move",
        tableId: "posts",
        columnId: "nope",
        index: 0,
      }),
    ).toThrow(OperationError);
  });
});

describe("column.remove", () => {
  test("removes a column that no relation uses", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "column.remove",
      tableId: "posts",
      columnId: "posts.title",
    });
    expect(columnNames(next, "posts")).toEqual(["id", "user_id"]);
    expect(next.relations).toEqual(doc.relations);
  });

  test("removes the relations that use the column as foreign key", () => {
    const next = apply(blogDiagram(), {
      type: "column.remove",
      tableId: "posts",
      columnId: "posts.user_id",
    });
    expect(next.relations).toEqual([]);
  });

  test("removes the relations that point at the column", () => {
    const next = apply(blogDiagram(), {
      type: "column.remove",
      tableId: "users",
      columnId: "users.id",
    });
    expect(next.relations).toEqual([]);
  });

  test("fails if the column does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "column.remove",
        tableId: "posts",
        columnId: "nope",
      }),
    ).toThrow(OperationError);
  });
});
