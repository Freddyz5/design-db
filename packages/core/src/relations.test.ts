import { describe, expect, test } from "bun:test";
import { getCardinality, isUniqueKey } from "./cardinality";
import { createColumn, createRelation, createTable } from "./factories";
import { apply, applyAll, OperationError } from "./operations";
import { blogDiagram, deepFreeze } from "./test-utils";

describe("relation.add", () => {
  test("adds a relation between existing columns", () => {
    const doc = deepFreeze(blogDiagram());
    const relation = createRelation({
      id: "posts_user_again",
      from: { tableId: "posts", columnIds: ["posts.user_id"] },
      to: { tableId: "users", columnIds: ["users.id"] },
      onDelete: "cascade",
    });
    const next = apply(doc, { type: "relation.add", relation });
    expect(next.relations).toEqual([...doc.relations, relation]);
    expect(next.tables).toBe(doc.tables);
  });

  test("fails if the id is already used", () => {
    const relation = createRelation({
      id: "posts_user",
      from: { tableId: "posts", columnIds: ["posts.user_id"] },
      to: { tableId: "users", columnIds: ["users.id"] },
    });
    expect(() =>
      apply(blogDiagram(), { type: "relation.add", relation }),
    ).toThrow(OperationError);
  });

  test("fails if a table or column does not exist", () => {
    const missingTable = createRelation({
      from: { tableId: "nope", columnIds: ["posts.user_id"] },
      to: { tableId: "users", columnIds: ["users.id"] },
    });
    const missingColumn = createRelation({
      from: { tableId: "posts", columnIds: ["posts.user_id"] },
      to: { tableId: "users", columnIds: ["nope"] },
    });
    const noColumns = createRelation({
      from: { tableId: "posts", columnIds: [] },
      to: { tableId: "users", columnIds: ["users.id"] },
    });
    for (const relation of [missingTable, missingColumn, noColumns]) {
      expect(() =>
        apply(blogDiagram(), { type: "relation.add", relation }),
      ).toThrow(OperationError);
    }
  });
});

describe("relation.update", () => {
  test("changes the actions and keeps the ends", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "relation.update",
      relationId: "posts_user",
      patch: { onDelete: "cascade", onUpdate: "restrict" },
    });
    expect(next.relations[0]).toEqual({
      ...doc.relations[0]!,
      onDelete: "cascade",
      onUpdate: "restrict",
    });
  });

  test("sets and removes the name", () => {
    const named = apply(blogDiagram(), {
      type: "relation.update",
      relationId: "posts_user",
      patch: { name: "fk_posts_user" },
    });
    expect(named.relations[0]!.name).toBe("fk_posts_user");

    const unnamed = apply(named, {
      type: "relation.update",
      relationId: "posts_user",
      patch: { name: undefined },
    });
    expect("name" in unnamed.relations[0]!).toBe(false);
  });

  test("fails if the relation does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "relation.update",
        relationId: "nope",
        patch: { onDelete: "cascade" },
      }),
    ).toThrow(OperationError);
  });
});

describe("relation.remove", () => {
  test("removes only the relation", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "relation.remove",
      relationId: "posts_user",
    });
    expect(next.relations).toEqual([]);
    expect(next.tables).toBe(doc.tables);
  });

  test("fails if the relation does not exist", () => {
    expect(() =>
      apply(blogDiagram(), { type: "relation.remove", relationId: "nope" }),
    ).toThrow(OperationError);
  });
});

describe("getCardinality", () => {
  const relation = (doc: ReturnType<typeof blogDiagram>) => doc.relations[0]!;

  test("a plain foreign key is 1:N", () => {
    const doc = blogDiagram();
    expect(getCardinality(doc, relation(doc))).toEqual({
      kind: "1:N",
      optional: false,
    });
  });

  test("a unique foreign key is 1:1", () => {
    const doc = apply(blogDiagram(), {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.user_id",
      patch: { unique: true },
    });
    expect(getCardinality(doc, relation(doc))?.kind).toBe("1:1");
  });

  test("a nullable foreign key is optional", () => {
    const doc = apply(blogDiagram(), {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.user_id",
      patch: { nullable: true },
    });
    expect(getCardinality(doc, relation(doc))).toEqual({
      kind: "1:N",
      optional: true,
    });
  });

  test("a foreign key that is the whole primary key is 1:1", () => {
    // profiles.user_id is both the primary key and the foreign key.
    const doc = applyAll(blogDiagram(), [
      {
        type: "table.add",
        table: createTable({
          id: "profiles",
          columns: [createColumn({ id: "profiles.user_id", primaryKey: true })],
        }),
      },
      {
        type: "relation.add",
        relation: createRelation({
          id: "profile_user",
          from: { tableId: "profiles", columnIds: ["profiles.user_id"] },
          to: { tableId: "users", columnIds: ["users.id"] },
        }),
      },
    ]);
    expect(getCardinality(doc, doc.relations[1]!)?.kind).toBe("1:1");
  });

  test("returns null when the relation is broken", () => {
    const doc = blogDiagram();
    const broken = {
      ...relation(doc),
      to: { tableId: "users", columnIds: ["nope"] },
    };
    expect(getCardinality(doc, broken)).toBeNull();
  });
});

describe("isUniqueKey", () => {
  const table = createTable({
    columns: [
      createColumn({ id: "a", primaryKey: true }),
      createColumn({ id: "b", primaryKey: true }),
      createColumn({ id: "c", unique: true }),
      createColumn({ id: "d" }),
    ],
  });

  test("part of a composite primary key is not unique", () => {
    expect(isUniqueKey(table, ["a"])).toBe(false);
  });

  test("the whole composite primary key is unique", () => {
    expect(isUniqueKey(table, ["a", "b"])).toBe(true);
    expect(isUniqueKey(table, ["b", "a", "d"])).toBe(true);
  });

  test("a set with a unique column is unique", () => {
    expect(isUniqueKey(table, ["c"])).toBe(true);
    expect(isUniqueKey(table, ["c", "d"])).toBe(true);
  });

  test("a plain column is not unique", () => {
    expect(isUniqueKey(table, ["d"])).toBe(false);
  });
});
