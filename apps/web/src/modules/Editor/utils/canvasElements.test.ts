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
  handleId,
  relationEdges,
  relationSides,
  tableNodes,
  tableSize,
} from "./canvasElements";

/** users ← posts (author_id), with users in the group "accounts". */
function blog(): Diagram {
  const users = createTable({
    id: "users",
    name: "users",
    groupId: "accounts",
    columns: [createColumn({ id: "users.id", name: "id", primaryKey: true })],
  });
  const posts = createTable({
    id: "posts",
    name: "posts",
    columns: [
      createColumn({ id: "posts.id", name: "id", primaryKey: true }),
      createColumn({
        id: "posts.author_id",
        name: "author_id",
        nullable: false,
      }),
    ],
  });
  let diagram = createDiagram({ name: "Blog" });
  for (const op of [
    {
      type: "group.add",
      group: createGroup({ id: "accounts", name: "Accounts", color: "blue" }),
    },
    { type: "table.add", table: users, position: { x: 0, y: 0 } },
    { type: "table.add", table: posts, position: { x: 400, y: 40 } },
    {
      type: "relation.add",
      relation: createRelation({
        id: "posts-author",
        from: { tableId: "posts", columnIds: ["posts.author_id"] },
        to: { tableId: "users", columnIds: ["users.id"] },
      }),
    },
  ] as const) {
    diagram = apply(diagram, op);
  }
  return diagram;
}

describe("tableNodes", () => {
  test("one node per table, at its position, with its strip and references", () => {
    const [users, posts] = tableNodes(blog());
    expect(users).toMatchObject({
      id: "users",
      type: "table",
      position: { x: 0, y: 0 },
      ariaLabel: "Tabla users",
    });
    expect(users!.data.strip.background).toBe("var(--color-group-1)");
    expect(users!.data.references).toEqual({});

    expect(posts!.position).toEqual({ x: 400, y: 40 });
    expect(posts!.data.strip.background).toBe("var(--color-flap-edge)");
    expect(posts!.data.references).toEqual({ "posts.author_id": "users.id" });
  });

  test("a table color in the layout wins over the group color", () => {
    const diagram = apply(blog(), {
      type: "table.update",
      tableId: "users",
      patch: { color: "#ffe680" },
    });
    expect(tableNodes(diagram)[0]!.data.strip.background).toBe("#ffe680");
  });

  test("a node that did not change is the same object", () => {
    const diagram = blog();
    const first = tableNodes(diagram);
    const moved = apply(diagram, {
      type: "table.move",
      tableId: "posts",
      position: { x: 500, y: 40 },
    });
    const second = tableNodes(moved, first);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[1]!.position).toEqual({ x: 500, y: 40 });
  });

  test("selects the nodes whose id is in the selection", () => {
    const diagram = blog();
    const first = tableNodes(diagram);
    expect(first.map((node) => node.selected)).toEqual([false, false]);

    const second = tableNodes(diagram, first, ["posts"]);
    expect(second[0]).toBe(first[0]);
    expect(second[1]!.selected).toBe(true);
    expect(tableNodes(diagram, second, ["posts"])[1]).toBe(second[1]);
  });

  test("a node that changed keeps what the canvas knows about it", () => {
    const diagram = blog();
    const first = tableNodes(diagram).map((node) => ({
      ...node,
      measured: { width: 300, height: 81 },
    }));
    const renamed = apply(diagram, {
      type: "table.update",
      tableId: "users",
      patch: { name: "people" },
    });
    const [users, posts] = tableNodes(renamed, first);
    expect(users).toMatchObject({
      measured: { width: 300, height: 81 },
      ariaLabel: "Tabla people",
    });
    // posts points at the renamed table, so its reference label changed too.
    expect(posts!.data.references).toEqual({ "posts.author_id": "people.id" });
  });

  test("tables without a position go in a column to the right of the rest", () => {
    const column = () => [createColumn({ name: "id", primaryKey: true })];
    let diagram = blog();
    for (const id of ["tags", "likes"]) {
      diagram = {
        ...diagram,
        tables: [
          ...diagram.tables,
          createTable({ id, name: id, columns: column() }),
        ],
      };
    }
    const nodes = tableNodes(diagram);
    const tags = nodes.find((node) => node.id === "tags")!;
    const likes = nodes.find((node) => node.id === "likes")!;
    // posts ends at 400 + 300; core leaves 96 after the last table.
    expect(tags.position).toEqual({ x: 796, y: 0 });
    expect(likes.position.x).toBe(796);
    expect(likes.position.y).toBe(tableSize(diagram.tables[2]!).height + 24);
  });
});

describe("relationSides", () => {
  test("uses the sides that face each other", () => {
    expect(relationSides(400, 0)).toEqual(["l", "r"]);
    expect(relationSides(0, 400)).toEqual(["r", "l"]);
  });

  test("uses both right sides when one table is above the other", () => {
    expect(relationSides(0, 0)).toEqual(["r", "r"]);
    expect(relationSides(100, 0)).toEqual(["r", "r"]);
    expect(relationSides(0, 299)).toEqual(["r", "r"]);
  });
});

describe("relationEdges", () => {
  test("one edge per relation, from the child column to the parent column", () => {
    const diagram = blog();
    const edges = relationEdges(diagram, tableNodes(diagram));
    expect(edges).toEqual([
      {
        id: "posts-author",
        type: "relation",
        source: "posts",
        target: "users",
        sourceHandle: handleId("posts.author_id", "l"),
        targetHandle: handleId("users.id", "r"),
        data: { cardinality: { kind: "1:N", optional: false } },
      },
    ]);
  });

  test("follows the positions of the nodes, not the ones saved in the diagram", () => {
    const diagram = blog();
    const nodes = tableNodes(diagram).map((node) =>
      node.id === "posts" ? { ...node, position: { x: -400, y: 0 } } : node,
    );
    const [edge] = relationEdges(diagram, nodes);
    expect(edge!.sourceHandle).toBe(handleId("posts.author_id", "r"));
    expect(edge!.targetHandle).toBe(handleId("users.id", "l"));
  });

  test("an edge that did not change is the same object", () => {
    const diagram = blog();
    const nodes = tableNodes(diagram);
    const first = relationEdges(diagram, nodes);
    expect(relationEdges(diagram, nodes, first)[0]).toBe(first[0]);

    const optional = apply(diagram, {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.author_id",
      patch: { nullable: true },
    });
    const second = relationEdges(optional, nodes, first);
    expect(second[0]).not.toBe(first[0]);
    expect(second[0]!.data!.cardinality.optional).toBe(true);
  });
});
