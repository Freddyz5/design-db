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
  dragHandleColumn,
  dragHandleId,
  ghostNodes,
  groupNodes,
  handleId,
  inView,
  nextSelection,
  nodeSize,
  relationEdges,
  relationSides,
  stripHandleId,
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
    expect(users!.data.strip.background).toContain("var(--color-group-1)");
    expect(users!.data.references).toEqual({});

    expect(posts!.position).toEqual({ x: 400, y: 40 });
    expect(posts!.data.strip.background).toBe("var(--color-sheet-head)");
    expect(posts!.data.references).toEqual({ "posts.author_id": "users.id" });
  });

  test("a table color in the layout wins over the group color", () => {
    const diagram = apply(blog(), {
      type: "table.update",
      tableId: "users",
      patch: { color: "#ffe680" },
    });
    expect(tableNodes(diagram)[0]!.data.strip.background).toContain("#ffe680");
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

    const second = tableNodes(diagram, first, { selection: ["posts"] });
    expect(second[0]).toBe(first[0]);
    expect(second[1]!.selected).toBe(true);
    expect(tableNodes(diagram, second, { selection: ["posts"] })[1]).toBe(
      second[1],
    );
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
    expect(tags.position).toEqual({ x: 856, y: 0 });
    expect(likes.position.x).toBe(856);
    expect(likes.position.y).toBe(tableSize(diagram.tables[2]!).height + 24);
  });
});

describe("groupNodes", () => {
  test("a region around the tables of the group, with room for its name", () => {
    const diagram = blog();
    const [accounts, ...rest] = groupNodes(diagram, tableNodes(diagram));
    expect(rest).toEqual([]);
    // users is at (0, 0), 360 wide and 30 + 2 * 24 + 3 = 81 tall, with the
    // row that names the cells.
    expect(accounts).toMatchObject({
      id: "group:accounts",
      type: "zone",
      position: { x: -24, y: -64 },
      width: 408,
      height: 169,
      zIndex: -1,
      selectable: false,
      dragHandle: ".group-handle",
    });
    expect(accounts!.data).toMatchObject({
      color: "var(--color-group-1)",
      count: 1,
    });
  });

  test("follows the tables as they move, and grows with a second table", () => {
    const grouped = apply(blog(), {
      type: "table.update",
      tableId: "posts",
      patch: { groupId: "accounts" },
    });
    const tables = tableNodes(grouped);
    const first = groupNodes(grouped, tables);
    // posts is at (400, 40), 360 wide and 30 + 3 * 24 + 3 = 105 tall.
    expect(first[0]).toMatchObject({
      position: { x: -24, y: -64 },
      width: 808,
      height: 233,
    });
    expect(first[0]!.data.count).toBe(2);
    expect(groupNodes(grouped, tables, first)[0]).toBe(first[0]);

    const moved = tables.map((node) =>
      node.id === "users" ? { ...node, position: { x: 100, y: 0 } } : node,
    );
    expect(groupNodes(grouped, moved, first)[0]!.position).toEqual({
      x: 76,
      y: -64,
    });
  });

  test("a group with a note leaves room for it above its tables", () => {
    const diagram = apply(blog(), {
      type: "group.update",
      groupId: "accounts",
      patch: { note: "Who writes" },
    });
    const [accounts] = groupNodes(diagram, tableNodes(diagram));
    expect(accounts!.position.y).toBe(-64 - 20);
    expect(accounts!.height).toBe(169 + 20);
  });

  test("a relation inside one group does not cross groups", () => {
    const grouped = apply(blog(), {
      type: "table.update",
      tableId: "posts",
      patch: { groupId: "accounts" },
    });
    const [edge] = relationEdges(grouped, tableNodes(grouped));
    expect(edge!.data!.crossesGroups).toBe(false);
  });
});

describe("view filters", () => {
  /** blog() plus tags (no group) with a relation to posts, and a plain column in posts. */
  function wider(): Diagram {
    let diagram = blog();
    for (const op of [
      {
        type: "column.add",
        tableId: "posts",
        column: createColumn({ id: "posts.title", name: "title" }),
      },
      {
        type: "table.add",
        table: createTable({
          id: "tags",
          name: "tags",
          columns: [
            createColumn({ id: "tags.id", name: "id", primaryKey: true }),
            createColumn({ id: "tags.post_id", name: "post_id" }),
          ],
        }),
        position: { x: 800, y: 0 },
      },
      {
        type: "relation.add",
        relation: createRelation({
          id: "tags-post",
          from: { tableId: "tags", columnIds: ["tags.post_id"] },
          to: { tableId: "posts", columnIds: ["posts.id"] },
        }),
      },
    ] as const) {
      diagram = apply(diagram, op);
    }
    return diagram;
  }
  const names = (node: { data: { columns: { name: string }[] } }) =>
    node.data.columns.map((column) => column.name);

  test("keys shows primary keys, unique columns and foreign keys, and counts the rest", () => {
    const [users, posts] = tableNodes(wider(), [], { columns: "keys" });
    expect(names(users!)).toEqual(["id"]);
    expect(users!.data.hidden).toBe(0);
    expect(names(posts!)).toEqual(["id", "author_id"]);
    expect(posts!.data.hidden).toBe(1);
    // The name, two columns and the row that says one is hidden.
    expect(nodeSize(posts!.data).height).toBe(30 + 3 * 24 + 3);
  });

  test("name shows no columns, and relations attach to the name strip", () => {
    const diagram = wider();
    const nodes = tableNodes(diagram, [], { columns: "name" });
    expect(nodes.map(names)).toEqual([[], [], []]);
    expect(nodeSize(nodes[0]!.data).height).toBe(33);

    const [author] = relationEdges(diagram, nodes);
    expect(author!.sourceHandle).toBe(stripHandleId("l"));
    expect(author!.targetHandle).toBe(stripHandleId("r"));
  });

  test("a region shrinks with the columns its tables show", () => {
    const diagram = wider();
    const all = groupNodes(diagram, tableNodes(diagram));
    const named = groupNodes(
      diagram,
      tableNodes(diagram, [], { columns: "name" }),
    );
    expect(all[0]!.height).toBe(169);
    expect(named[0]!.height).toBe(121);
  });

  const ids = (edges: { id: string }[]) => edges.map((edge) => edge.id);

  test("group hides the relations that go to another group, unless a table of theirs is selected", () => {
    // users is in a group and posts and tags are in none.
    const diagram = wider();
    const nodes = tableNodes(diagram);
    expect(ids(relationEdges(diagram, nodes))).toEqual([
      "posts-author",
      "tags-post",
    ]);
    expect(
      ids(relationEdges(diagram, nodes, [], { relations: "group" })),
    ).toEqual(["tags-post"]);
    expect(
      ids(
        relationEdges(diagram, nodes, [], {
          relations: "group",
          selection: ["users"],
        }),
      ),
    ).toEqual(["posts-author", "tags-post"]);
  });

  test("focus shows only the relations of the selected tables, and the selected relation", () => {
    const diagram = wider();
    const nodes = tableNodes(diagram);
    const focus = { relations: "focus" } as const;
    expect(relationEdges(diagram, nodes, [], focus)).toEqual([]);
    expect(
      ids(relationEdges(diagram, nodes, [], { ...focus, selection: ["tags"] })),
    ).toEqual(["tags-post"]);
    expect(
      ids(
        relationEdges(diagram, nodes, [], {
          ...focus,
          selectedRelationId: "posts-author",
        }),
      ),
    ).toEqual(["posts-author"]);
  });

  test("focus fades the tables that have nothing to do with the selected ones", () => {
    const diagram = wider();
    const dimmed = (view: Parameters<typeof tableNodes>[2]) =>
      tableNodes(diagram, [], view).map((node) => node.data.dimmed);
    expect(dimmed({ relations: "focus" })).toEqual([false, false, false]);
    expect(dimmed({ relations: "focus", selection: ["users"] })).toEqual([
      false,
      false,
      true,
    ]);
    expect(dimmed({ relations: "all", selection: ["users"] })).toEqual([
      false,
      false,
      false,
    ]);
  });
});

describe("table in focus", () => {
  function chain(): Diagram {
    // users ← posts ← tags
    return apply(
      apply(blog(), {
        type: "table.add",
        table: createTable({
          id: "tags",
          name: "tags",
          columns: [createColumn({ id: "tags.post_id", name: "post_id" })],
        }),
        position: { x: 800, y: 0 },
      }),
      {
        type: "relation.add",
        relation: createRelation({
          id: "tags-post",
          from: { tableId: "tags", columnIds: ["tags.post_id"] },
          to: { tableId: "posts", columnIds: ["posts.id"] },
        }),
      },
    );
  }

  test("fades the tables that have no relation with it", () => {
    const nodes = tableNodes(chain(), [], { focusedTableId: "users" });
    expect(nodes.map((node) => node.data.dimmed)).toEqual([false, false, true]);
    expect(nodes.map((node) => node.data.focused)).toEqual([
      true,
      false,
      false,
    ]);

    const middle = tableNodes(chain(), [], { focusedTableId: "posts" });
    expect(middle.map((node) => node.data.dimmed)).toEqual([
      false,
      false,
      false,
    ]);
  });

  test("wins over the focus filter, and a missing table is no focus", () => {
    const diagram = chain();
    const dimmed = (view: Parameters<typeof tableNodes>[2]) =>
      tableNodes(diagram, [], view).map((node) => node.data.dimmed);
    expect(
      dimmed({
        relations: "focus",
        selection: ["tags"],
        focusedTableId: "users",
      }),
    ).toEqual([false, false, true]);
    expect(dimmed({ focusedTableId: "gone" })).toEqual([false, false, false]);
  });

  test("its relations stand out and come last; the rest fade", () => {
    const diagram = chain();
    const edges = relationEdges(diagram, tableNodes(diagram), [], {
      focusedTableId: "users",
    });
    expect(edges.map((edge) => [edge.id, edge.data?.emphasis])).toEqual([
      ["tags-post", "low"],
      ["posts-author", "high"],
    ]);
    const calm = relationEdges(diagram, tableNodes(diagram));
    expect(calm.map((edge) => edge.data?.emphasis)).toEqual([
      undefined,
      undefined,
    ]);
  });

  test("its relations show under the focus filter", () => {
    const diagram = chain();
    const edges = relationEdges(diagram, tableNodes(diagram), [], {
      relations: "focus",
      focusedTableId: "tags",
    });
    expect(edges.map((edge) => edge.id)).toEqual(["tags-post"]);
  });

  test("an edge whose emphasis changes is a new object", () => {
    const diagram = chain();
    const nodes = tableNodes(diagram);
    const calm = relationEdges(diagram, nodes);
    const lit = relationEdges(diagram, nodes, calm, { focusedTableId: "tags" });
    expect(lit.find((edge) => edge.id === "posts-author")).not.toBe(
      calm.find((edge) => edge.id === "posts-author"),
    );
    expect(
      relationEdges(diagram, nodes, lit, { focusedTableId: "tags" }),
    ).toEqual(lit);
  });
});

describe("change marks", () => {
  test("without showChanges nothing is marked", () => {
    const diagram = apply(blog(), { type: "base.set", at: "now" });
    expect(tableNodes(diagram)[0]!.data.marks).toBeNull();
  });

  test("marks new tables, new relations, and strikes removed columns into the size", () => {
    let diagram = apply(blog(), { type: "base.set", at: "now" });
    diagram = apply(diagram, {
      type: "column.remove",
      tableId: "users",
      columnId: "users.id",
    });
    diagram = apply(diagram, {
      type: "table.add",
      table: createTable({ id: "tags", name: "tags" }),
      position: { x: 0, y: 300 },
    });
    const view = { showChanges: true };
    const nodes = tableNodes(diagram, [], view);
    const users = nodes.find((n) => n.id === "users")!;
    expect(users.data.columns).toEqual([]);
    expect(users.data.marks!.removed.map((c) => c.name)).toEqual(["id"]);
    // The row that names the cells, and the struck row.
    expect(nodeSize(users.data).height).toBe(30 + 2 * 24 + 3);
    expect(nodes.find((n) => n.id === "tags")!.data.marks!.table).toBe("added");
    // The relation to users.id went with the column.
    expect(relationEdges(diagram, nodes, [], view)).toEqual([]);
  });

  test("a new relation is marked as added", () => {
    let diagram = apply(blog(), {
      type: "relation.remove",
      relationId: "posts-author",
    });
    diagram = apply(diagram, { type: "base.set", at: "now" });
    diagram = apply(diagram, {
      type: "relation.add",
      relation: createRelation({
        id: "again",
        from: { tableId: "posts", columnIds: ["posts.author_id"] },
        to: { tableId: "users", columnIds: ["users.id"] },
      }),
    });
    const view = { showChanges: true };
    const [edge] = relationEdges(
      diagram,
      tableNodes(diagram, [], view),
      [],
      view,
    );
    expect(edge!.data!.change).toBe("added");
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
        selected: false,
        data: {
          cardinality: { kind: "1:N", optional: false },
          crossesGroups: true,
        },
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

  test("selects the edge of the selected relation", () => {
    const diagram = blog();
    const nodes = tableNodes(diagram);
    const first = relationEdges(diagram, nodes);
    const second = relationEdges(diagram, nodes, first, {
      selectedRelationId: "posts-author",
    });
    expect(second[0]!.selected).toBe(true);
    expect(
      relationEdges(diagram, nodes, second, {
        selectedRelationId: "posts-author",
      })[0],
    ).toBe(second[0]);
  });

  test("the drag point of a column gives the column back", () => {
    expect(dragHandleColumn(dragHandleId("posts.author_id"))).toBe(
      "posts.author_id",
    );
    expect(dragHandleColumn(dragHandleId("a:b"))).toBe("a:b");
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

describe("header and note", () => {
  test("with every column shown, a table names its cells and shows its note", () => {
    const diagram = apply(blog(), {
      type: "table.update",
      tableId: "users",
      patch: { comment: "Who writes" },
    });
    const [users] = tableNodes(diagram);
    expect(users!.data.header).toBe(true);
    expect(users!.data.note).toBe("Who writes");
    // Name strip, header row, one column, borders, and one line of note.
    expect(nodeSize(users!.data).height).toBe(30 + 2 * 24 + 3 + 6 + 16);
    expect(tableSize(diagram.tables[0]!).height).toBe(30 + 2 * 24 + 3 + 6 + 16);

    const [keys] = tableNodes(diagram, [], { columns: "keys" });
    expect(keys!.data.header).toBe(false);
    expect(keys!.data.note).toBeNull();
  });

  test("each column row knows what it says", () => {
    const [, posts] = tableNodes(blog());
    expect(posts!.data.faces["posts.author_id"]).toEqual({
      rules: "not null",
      reference: { table: "users", column: "id", group: 1 },
      enumValues: null,
    });
  });
});

describe("nextSelection", () => {
  test("adds the picked tables and drops the released ones", () => {
    expect(
      nextSelection(
        ["users"],
        [
          { id: "users", selected: false },
          { id: "posts", selected: true },
        ],
      ),
    ).toEqual(["posts"]);
    expect(nextSelection(["users"], [{ id: "posts", selected: true }])).toEqual(
      ["users", "posts"],
    );
  });

  test("is the same array when nothing changed", () => {
    const selection = ["users", "posts"];
    expect(nextSelection(selection, [{ id: "users", selected: true }])).toBe(
      selection,
    );
  });
});

describe("dragging", () => {
  test("a table being dragged keeps its position when the view changes", () => {
    const diagram = blog();
    const [users, posts] = tableNodes(diagram);
    const dragged = { ...users!, position: { x: 90, y: 90 }, dragging: true };
    const next = tableNodes(diagram, [dragged, posts!], {
      selection: ["users"],
    });
    expect(next[0]?.position).toEqual({ x: 90, y: 90 });
    expect(next[0]?.selected).toBe(true);
  });
});

describe("inView", () => {
  const screen = { width: 800, height: 600 };
  const box = { x: 100, y: 100, width: 300, height: 200 };

  test("a box inside the screen is in view", () => {
    expect(inView(box, { x: 0, y: 0, zoom: 1 }, screen)).toBe(true);
  });

  test("a box moved or zoomed past an edge is not", () => {
    expect(inView(box, { x: -150, y: 0, zoom: 1 }, screen)).toBe(false);
    expect(inView(box, { x: 0, y: 0, zoom: 3 }, screen)).toBe(false);
    expect(inView(box, { x: 0, y: 450, zoom: 1 }, screen)).toBe(false);
  });
});

describe("ghostNodes", () => {
  const removed = () =>
    apply(apply(blog(), { type: "base.set", at: "2026-11-13T10:00:00Z" }), {
      type: "table.remove",
      tableId: "posts",
    });

  test("a removed table stands where it was, only with the changes shown", () => {
    const diagram = removed();
    expect(ghostNodes(diagram)).toEqual([]);
    const [posts, ...rest] = ghostNodes(diagram, [], { showChanges: true });
    expect(rest).toEqual([]);
    expect(posts).toMatchObject({
      id: "ghost:posts",
      type: "ghost",
      position: { x: 400, y: 40 },
      selectable: false,
      draggable: false,
    });
    expect(posts!.data.columns.map((c) => c.name)).toEqual(["id", "author_id"]);
  });

  test("with only the names shown it has no rows, and it fades with a focus", () => {
    const diagram = removed();
    const [named] = ghostNodes(diagram, [], {
      showChanges: true,
      columns: "name",
    });
    expect(named!.data.columns).toEqual([]);
    const [faded] = ghostNodes(diagram, [], {
      showChanges: true,
      focusedTableId: "users",
    });
    expect(faded!.data.dimmed).toBe(true);
  });

  test("a ghost that did not change is the same object", () => {
    const diagram = removed();
    const first = ghostNodes(diagram, [], { showChanges: true });
    expect(ghostNodes(diagram, first, { showChanges: true })[0]).toBe(first[0]);
  });
});
