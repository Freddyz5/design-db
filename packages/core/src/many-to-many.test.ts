import { describe, expect, test } from "bun:test";
import { getCardinality } from "./cardinality";
import { createColumn, createTable } from "./factories";
import { createManyToMany } from "./many-to-many";
import { apply, OperationError } from "./operations";
import type { Diagram } from "./schema";
import { blogDiagram, deepFreeze } from "./test-utils";

/** Blog diagram plus a tags table at (300, 200). */
function withTags(): Diagram {
  return apply(blogDiagram(), {
    type: "table.add",
    table: createTable({
      id: "tags",
      name: "tags",
      columns: [
        createColumn({
          id: "tags.id",
          name: "id",
          type: "uuid",
          primaryKey: true,
        }),
      ],
    }),
    position: { x: 300, y: 200 },
  });
}

const tableById = (doc: Diagram, id: string) =>
  doc.tables.find((t) => t.id === id)!;

describe("createManyToMany", () => {
  test("creates the join table with a composite primary key", () => {
    const doc = deepFreeze(withTags());
    const { diagram, tableId } = createManyToMany(doc, "posts", "tags");
    const join = tableById(diagram, tableId);

    expect(join.name).toBe("posts_tags");
    expect(join.columns.map((c) => [c.name, c.type])).toEqual([
      ["posts_id", "int"],
      ["tags_id", "uuid"],
    ]);
    expect(join.columns.every((c) => c.primaryKey && !c.nullable)).toBe(true);
  });

  test("adds one cascading 1:N relation to each table", () => {
    const { diagram, tableId } = createManyToMany(withTags(), "posts", "tags");
    const added = diagram.relations.filter((r) => r.from.tableId === tableId);
    const join = tableById(diagram, tableId);

    expect(added.map((r) => [r.to.tableId, r.to.columnIds])).toEqual([
      ["posts", ["posts.id"]],
      ["tags", ["tags.id"]],
    ]);
    expect(added.map((r) => r.from.columnIds)).toEqual([
      [join.columns[0]!.id],
      [join.columns[1]!.id],
    ]);
    for (const relation of added) {
      expect(relation.onDelete).toBe("cascade");
      expect(getCardinality(diagram, relation)).toEqual({
        kind: "1:N",
        optional: false,
      });
    }
  });

  test("places the join table between both tables", () => {
    const { diagram, tableId } = createManyToMany(withTags(), "posts", "tags");
    expect(diagram.layout.tables[tableId]).toEqual({ x: 300, y: 100 });
  });

  test("uses the given name and avoids names already taken", () => {
    const named = createManyToMany(withTags(), "posts", "tags", {
      name: "post_tags",
    });
    expect(tableById(named.diagram, named.tableId).name).toBe("post_tags");

    const again = createManyToMany(named.diagram, "posts", "tags", {
      name: "POST_TAGS",
    });
    expect(tableById(again.diagram, again.tableId).name).toBe("POST_TAGS_2");
  });

  test("works on the same table twice", () => {
    const { diagram, tableId } = createManyToMany(
      blogDiagram(),
      "users",
      "users",
      { name: "follows" },
    );
    const join = tableById(diagram, tableId);
    expect(join.columns.map((c) => c.name)).toEqual(["users_id", "users_id_2"]);
    expect(
      diagram.relations.filter((r) => r.to.tableId === "users"),
    ).toHaveLength(3);
  });

  test("copies composite primary keys", () => {
    const doc = apply(withTags(), {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.title",
      patch: { primaryKey: true },
    });
    const { diagram, tableId } = createManyToMany(doc, "posts", "tags");
    expect(tableById(diagram, tableId).columns.map((c) => c.name)).toEqual([
      "posts_id",
      "posts_title",
      "tags_id",
    ]);
    expect(diagram.relations.at(-2)!.to.columnIds).toEqual([
      "posts.id",
      "posts.title",
    ]);
  });

  test("fails if a table has no primary key", () => {
    const doc = apply(withTags(), {
      type: "column.update",
      tableId: "tags",
      columnId: "tags.id",
      patch: { primaryKey: false },
    });
    expect(() => createManyToMany(doc, "posts", "tags")).toThrow(
      OperationError,
    );
  });

  test("fails if a table does not exist", () => {
    expect(() => createManyToMany(withTags(), "posts", "nope")).toThrow(
      OperationError,
    );
  });
});
