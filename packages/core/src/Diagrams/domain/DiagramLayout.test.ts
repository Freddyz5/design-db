import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { createGroup } from "../../Groups";
import { OperationError } from "../../shared";
import { createTable } from "../../Tables";
import type { Diagram } from "./Diagram";
import { blogDiagram, deepFreeze } from "./DiagramFixtures";
import {
  DEFAULT_LAYOUT_OPTIONS,
  estimateTableSize,
  layoutPositions,
  placementOrigin,
  toLayoutGraph,
  unplacedTableIds,
} from "./DiagramLayout";
import { apply, applyAll } from "./DiagramOperations";

/** Blog diagram with users and posts in a "content" group, plus tags alone. */
function grouped(): Diagram {
  return applyAll(blogDiagram(), [
    {
      type: "group.add",
      group: createGroup({ id: "content", name: "Content" }),
    },
    { type: "table.update", tableId: "posts", patch: { groupId: "content" } },
    { type: "table.add", table: createTable({ id: "tags", name: "tags" }) },
  ]);
}

describe("estimateTableSize", () => {
  test("grows with the number of columns and the longest name", () => {
    const small = estimateTableSize(createTable({ name: "t" }));
    const big = estimateTableSize(
      createTable({
        name: "t",
        columns: [
          createColumn({
            name: "a_really_long_column_name",
            type: "varchar(255)",
          }),
          createColumn({ name: "b" }),
        ],
      }),
    );
    expect(small).toEqual({ width: 200, height: 48 });
    expect(big.height).toBe(48 + 2 * 26);
    expect(big.width).toBeGreaterThan(200);
  });
});

describe("toLayoutGraph", () => {
  test("tables in a group are children of the group node", () => {
    const graph = toLayoutGraph(grouped());
    expect(graph.layoutOptions).toEqual({ ...DEFAULT_LAYOUT_OPTIONS });
    expect(graph.children.map((n) => n.id)).toEqual([
      "users",
      "group:content",
      "tags",
    ]);
    const group = graph.children[1]!;
    expect(group.children!.map((n) => n.id)).toEqual(["posts"]);
    expect(group.width).toBeUndefined();
  });

  test("relations are edges from the referenced table", () => {
    expect(toLayoutGraph(blogDiagram()).edges).toEqual([
      { id: "posts_user", sources: ["users"], targets: ["posts"] },
    ]);
  });

  test("uses the given sizes and estimates the rest", () => {
    const graph = toLayoutGraph(blogDiagram(), {
      sizes: { users: { width: 300, height: 120 } },
    });
    expect(graph.children[0]).toEqual({ id: "users", width: 300, height: 120 });
    expect(graph.children[1]!.height).toBe(48 + 3 * 26);
  });

  test("tableIds limits the tables and the edges", () => {
    const graph = toLayoutGraph(grouped(), { tableIds: ["posts", "tags"] });
    expect(graph.children.map((n) => n.id)).toEqual(["group:content", "tags"]);
    expect(graph.edges).toEqual([]);
  });

  test("custom layout options are merged with the defaults", () => {
    const graph = toLayoutGraph(blogDiagram(), {
      layoutOptions: { "elk.direction": "DOWN" },
    });
    expect(graph.layoutOptions!["elk.direction"]).toBe("DOWN");
    expect(graph.layoutOptions!["elk.algorithm"]).toBe("layered");
  });
});

describe("layoutPositions", () => {
  test("makes positions inside groups absolute and applies the offset", () => {
    const laidOut = {
      children: [
        { id: "users", x: 10, y: 20 },
        {
          id: "group:content",
          x: 300,
          y: 100,
          children: [{ id: "posts", x: 24, y: 48 }],
        },
        { id: "tags" },
      ],
    };
    expect(layoutPositions(laidOut, { x: 1000, y: 0 })).toEqual({
      users: { x: 1010, y: 20 },
      posts: { x: 1324, y: 148 },
    });
  });
});

describe("layout.place", () => {
  test("moves several tables in one step and keeps their color", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, {
      type: "layout.place",
      positions: { users: { x: 5, y: 6 }, posts: { x: 7, y: 8 } },
    });
    expect(next.layout.tables).toEqual({
      users: { x: 5, y: 6 },
      posts: { x: 7, y: 8, color: "blue" },
    });
    expect(next.tables).toBe(doc.tables);
  });

  test("fails if a table does not exist", () => {
    expect(() =>
      apply(blogDiagram(), {
        type: "layout.place",
        positions: { nope: { x: 0, y: 0 } },
      }),
    ).toThrow(OperationError);
  });
});

describe("unplacedTableIds / placementOrigin", () => {
  test("lists tables without a position", () => {
    const doc = blogDiagram();
    delete doc.layout.tables.posts;
    expect(unplacedTableIds(doc)).toEqual(["posts"]);
  });

  test("new tables go to the right of the placed ones", () => {
    const doc = blogDiagram();
    expect(
      placementOrigin(doc, { posts: { width: 250, height: 100 } }),
    ).toEqual({ x: 300 + 250 + 96, y: 0 });
  });

  test("starts at 0,0 when nothing has a position", () => {
    const doc = blogDiagram();
    doc.layout.tables = {};
    expect(placementOrigin(doc)).toEqual({ x: 0, y: 0 });
  });
});
