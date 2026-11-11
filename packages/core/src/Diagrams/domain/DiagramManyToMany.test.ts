import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { getCardinality } from "../../Relations";
import { OperationError } from "../../shared";
import { createTable } from "../../Tables";
import type { Diagram } from "./Diagram";
import { blogDiagram, deepFreeze } from "./DiagramFixtures";
import { createManyToMany } from "./DiagramManyToMany";
import { apply } from "./DiagramOperations";

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

describe("createManyToMany", () => {
  test("adds the join table and its two 1:N relations", () => {
    const doc = deepFreeze(withTags());
    const { diagram, tableId } = createManyToMany(doc, "posts", "tags");
    const join = diagram.tables.find((t) => t.id === tableId)!;
    const added = diagram.relations.filter((r) => r.from.tableId === tableId);

    expect(join.name).toBe("posts_tags");
    expect(added.map((r) => r.to.tableId)).toEqual(["posts", "tags"]);
    for (const relation of added) {
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

  test("avoids the names of the tables already in the diagram", () => {
    const first = createManyToMany(withTags(), "posts", "tags");
    const second = createManyToMany(first.diagram, "posts", "tags");
    const name = (d: Diagram, id: string) =>
      d.tables.find((t) => t.id === id)!.name;
    expect(name(second.diagram, second.tableId)).toBe("posts_tags_2");
  });

  test("fails if a table does not exist", () => {
    expect(() => createManyToMany(withTags(), "posts", "nope")).toThrow(
      OperationError,
    );
  });
});
