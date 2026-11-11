import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { createGroup } from "../../Groups";
import { createRelation } from "../../Relations";
import { OperationError } from "../../shared";
import { createTable } from "../../Tables";
import type { Diagram } from "./Diagram";
import { blogDiagram, deepFreeze } from "./DiagramFixtures";
import { apply, applyAll } from "./DiagramOperations";

const columnNames = (doc: Diagram, tableId: string) =>
  doc.tables.find((t) => t.id === tableId)!.columns.map((c) => c.name);

describe("table.add", () => {
  test("adds the table at the end with its position", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "table.add",
      table: createTable({ id: "tags", name: "tags" }),
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
    expect(next.layout).toBe(doc.layout);
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
    const next = apply(deepFreeze(blogDiagram()), {
      type: "table.remove",
      tableId: "users",
    });
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

describe("column operations", () => {
  test("add, update and move change only that table", () => {
    const doc = deepFreeze(blogDiagram());
    const next = applyAll(doc, [
      {
        type: "column.add",
        tableId: "users",
        column: createColumn({ id: "users.name", name: "name" }),
        index: 1,
      },
      {
        type: "column.update",
        tableId: "users",
        columnId: "users.name",
        patch: { name: "full_name" },
      },
      {
        type: "column.move",
        tableId: "users",
        columnId: "users.name",
        index: 0,
      },
    ]);
    expect(columnNames(next, "users")).toEqual(["full_name", "id", "email"]);
    expect(next.tables[1]).toBe(doc.tables[1]!);
  });

  test("renaming a foreign key column keeps the relation", () => {
    const doc = blogDiagram();
    const next = apply(doc, {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.user_id",
      patch: { name: "author_id" },
    });
    expect(next.relations).toEqual(doc.relations);
  });

  test("moving a column keeps the relations", () => {
    const doc = blogDiagram();
    const next = apply(doc, {
      type: "column.move",
      tableId: "posts",
      columnId: "posts.user_id",
      index: 0,
    });
    expect(columnNames(next, "posts")).toEqual(["user_id", "id", "title"]);
    expect(next.relations).toEqual(doc.relations);
  });

  test("removing a column that no relation uses keeps the relations", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "column.remove",
      tableId: "posts",
      columnId: "posts.title",
    });
    expect(columnNames(next, "posts")).toEqual(["id", "user_id"]);
    expect(next.relations).toEqual(doc.relations);
  });

  test("removing a foreign key column removes its relations", () => {
    const next = apply(blogDiagram(), {
      type: "column.remove",
      tableId: "posts",
      columnId: "posts.user_id",
    });
    expect(next.relations).toEqual([]);
  });

  test("removing a column that a relation points at removes it", () => {
    const next = apply(blogDiagram(), {
      type: "column.remove",
      tableId: "users",
      columnId: "users.id",
    });
    expect(next.relations).toEqual([]);
  });

  test("fail if the table or the column does not exist", () => {
    const doc = blogDiagram();
    expect(() =>
      apply(doc, {
        type: "column.add",
        tableId: "nope",
        column: createColumn(),
      }),
    ).toThrow(OperationError);
    expect(() =>
      apply(doc, { type: "column.remove", tableId: "posts", columnId: "nope" }),
    ).toThrow(OperationError);
  });
});

describe("relation operations", () => {
  test("relation.add adds a relation between existing columns", () => {
    const doc = deepFreeze(blogDiagram());
    const relation = createRelation({
      id: "again",
      from: { tableId: "posts", columnIds: ["posts.user_id"] },
      to: { tableId: "users", columnIds: ["users.id"] },
      onDelete: "cascade",
    });
    const next = apply(doc, { type: "relation.add", relation });
    expect(next.relations).toEqual([...doc.relations, relation]);
    expect(next.tables).toBe(doc.tables);
  });

  test("relation.add fails if the id is used or an end does not exist", () => {
    const ends = {
      from: { tableId: "posts", columnIds: ["posts.user_id"] },
      to: { tableId: "users", columnIds: ["users.id"] },
    };
    const invalid = [
      createRelation({ id: "posts_user", ...ends }),
      createRelation({ ...ends, from: { tableId: "nope", columnIds: ["x"] } }),
      createRelation({
        ...ends,
        to: { tableId: "users", columnIds: ["nope"] },
      }),
      createRelation({ ...ends, from: { tableId: "posts", columnIds: [] } }),
    ];
    for (const relation of invalid) {
      expect(() =>
        apply(blogDiagram(), { type: "relation.add", relation }),
      ).toThrow(OperationError);
    }
  });

  test("relation.update changes only that relation", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "relation.update",
      relationId: "posts_user",
      patch: { onDelete: "cascade" },
    });
    expect(next.relations[0]).toEqual({
      ...doc.relations[0]!,
      onDelete: "cascade",
    });
  });

  test("relation.remove removes only the relation", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "relation.remove",
      relationId: "posts_user",
    });
    expect(next.relations).toEqual([]);
    expect(next.tables).toBe(doc.tables);
  });

  test("update and remove fail if the relation does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "relation.update",
        relationId: "nope",
        patch: { onDelete: "cascade" },
      }),
    ).toThrow(OperationError);
    expect(() =>
      apply(blogDiagram(), { type: "relation.remove", relationId: "nope" }),
    ).toThrow(OperationError);
  });
});

describe("group operations", () => {
  const withGroup = () =>
    apply(blogDiagram(), {
      type: "group.add",
      group: createGroup({ id: "content", name: "Content", color: "teal" }),
    });

  test("group.add adds a group and fails on a repeated id", () => {
    const doc = withGroup();
    expect(doc.groups.map((g) => g.name)).toEqual(["Content"]);
    expect(() =>
      apply(doc, { type: "group.add", group: createGroup({ id: "content" }) }),
    ).toThrow(OperationError);
  });

  test("group.update changes the group", () => {
    const next = apply(deepFreeze(withGroup()), {
      type: "group.update",
      groupId: "content",
      patch: { name: "Posts", color: undefined },
    });
    expect(next.groups).toEqual([{ id: "content", name: "Posts" }]);
  });

  test("table.update puts a table in a group and takes it out", () => {
    const grouped = apply(withGroup(), {
      type: "table.update",
      tableId: "posts",
      patch: { groupId: "content" },
    });
    expect(grouped.tables[1]!.groupId).toBe("content");

    const ungrouped = apply(grouped, {
      type: "table.update",
      tableId: "posts",
      patch: { groupId: undefined },
    });
    expect("groupId" in ungrouped.tables[1]!).toBe(false);
  });

  test("a table cannot point at a group that does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "table.update",
        tableId: "posts",
        patch: { groupId: "nope" },
      }),
    ).toThrow(OperationError);
    expect(() =>
      apply(blogDiagram(), {
        type: "table.add",
        table: createTable({ groupId: "nope" }),
      }),
    ).toThrow(OperationError);
  });

  test("group.remove keeps its tables, without a group", () => {
    const doc = apply(withGroup(), {
      type: "table.update",
      tableId: "posts",
      patch: { groupId: "content" },
    });
    const next = apply(doc, { type: "group.remove", groupId: "content" });
    expect(next.groups).toEqual([]);
    expect(next.tables).toHaveLength(2);
    expect("groupId" in next.tables[1]!).toBe(false);
  });

  test("update and remove fail if the group does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "group.update",
        groupId: "nope",
        patch: { name: "x" },
      }),
    ).toThrow(OperationError);
    expect(() =>
      apply(blogDiagram(), { type: "group.remove", groupId: "nope" }),
    ).toThrow(OperationError);
  });
});
