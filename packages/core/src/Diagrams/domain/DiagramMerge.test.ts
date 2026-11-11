import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { createEnum } from "../../Enums";
import { createGroup } from "../../Groups";
import { createRelation } from "../../Relations";
import { createTable } from "../../Tables";
import { createDiagram, type Diagram } from "./Diagram";
import { blogDiagram, deepFreeze } from "./DiagramFixtures";
import { mergeDiagram } from "./DiagramMerge";
import { validate } from "./DiagramValidation";

/**
 * What a reader would return for the blog after editing its SQL: new ids,
 * no positions, posts.title renamed to headline and a new tags table.
 */
function edited(): Diagram {
  const users = createTable({
    name: "USERS",
    columns: [
      createColumn({ name: "id", type: "int", primaryKey: true }),
      createColumn({ name: "email", type: "varchar(255)" }),
    ],
  });
  const posts = createTable({
    name: "posts",
    columns: [
      createColumn({ name: "id", type: "int", primaryKey: true }),
      createColumn({ name: "user_id", type: "int", nullable: false }),
      createColumn({ name: "headline", type: "text" }),
    ],
  });
  const tags = createTable({
    name: "tags",
    columns: [createColumn({ name: "id", type: "int", primaryKey: true })],
  });
  return {
    ...createDiagram({ name: "Imported", dialect: "mysql" }),
    tables: [users, posts, tags],
    relations: [
      createRelation({
        from: { tableId: posts.id, columnIds: [posts.columns[1]!.id] },
        to: { tableId: users.id, columnIds: [users.columns[0]!.id] },
        onDelete: "cascade",
      }),
    ],
  };
}

const byName = (doc: Diagram, name: string) =>
  doc.tables.find((t) => t.name.toLowerCase() === name.toLowerCase())!;

describe("mergeDiagram replace", () => {
  test("uses the imported schema and keeps ids and positions of what existed", () => {
    const current = deepFreeze(blogDiagram());
    const next = mergeDiagram(current, edited(), "replace");

    expect(next.id).toBe("blog");
    expect(next.name).toBe("Blog");
    expect(next.dialect).toBe("generic");
    expect(
      next.tables.map((t) => [t.id === "users", t.id === "posts"]),
    ).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    expect(byName(next, "posts").columns.map((c) => c.id)).toEqual([
      "posts.id",
      "posts.user_id",
      expect.not.stringMatching(/^posts\./),
    ]);
    expect(next.layout.tables).toEqual({
      users: { x: 0, y: 0 },
      posts: { x: 300, y: 0, color: "blue" },
    });
    expect(next.layout.viewport).toBe(current.layout.viewport);
  });

  test("a relation with the same ends keeps its id and takes the new actions", () => {
    const next = mergeDiagram(blogDiagram(), edited(), "replace");
    expect(next.relations).toHaveLength(1);
    expect(next.relations[0]).toMatchObject({
      id: "posts_user",
      onDelete: "cascade",
    });
    expect(validate(next)).toEqual([]);
  });

  test("tables that are not in the import are removed", () => {
    const imported = {
      ...edited(),
      tables: edited().tables.slice(2),
      relations: [],
    };
    const next = mergeDiagram(blogDiagram(), imported, "replace");
    expect(next.tables.map((t) => t.name)).toEqual(["tags"]);
    expect(next.layout.tables).toEqual({});
  });

  test("without groups in the import, the current groups and membership stay", () => {
    const current: Diagram = {
      ...blogDiagram(),
      groups: [createGroup({ id: "g", name: "Content", color: "teal" })],
    };
    current.tables = current.tables.map((t) =>
      t.id === "posts" ? { ...t, groupId: "g" } : t,
    );
    const next = mergeDiagram(current, edited(), "replace");
    expect(next.groups).toEqual(current.groups);
    expect(byName(next, "posts").groupId).toBe("g");
    expect(byName(next, "tags").groupId).toBeUndefined();
  });

  test("imported groups replace the current ones, keeping id and color by name", () => {
    const current: Diagram = {
      ...blogDiagram(),
      groups: [createGroup({ id: "g", name: "content", color: "teal" })],
    };
    const imported = edited();
    const group = createGroup({ name: "Content" });
    imported.groups = [group];
    imported.tables[2] = { ...imported.tables[2]!, groupId: group.id };
    const next = mergeDiagram(current, imported, "replace");
    expect(next.groups).toEqual([{ id: "g", name: "Content", color: "teal" }]);
    expect(byName(next, "tags").groupId).toBe("g");
    expect(byName(next, "posts").groupId).toBeUndefined();
  });

  test("enums with the same name keep their id", () => {
    const current = {
      ...blogDiagram(),
      enums: [createEnum({ id: "e", name: "status" })],
    };
    const imported = {
      ...edited(),
      enums: [createEnum({ name: "STATUS", values: ["a"] })],
    };
    const next = mergeDiagram(current, imported, "replace");
    expect(next.enums).toEqual([{ id: "e", name: "STATUS", values: ["a"] }]);
  });

  test("positions that come with the import win (JSON projects)", () => {
    const imported = edited();
    imported.layout.tables[imported.tables[0]!.id] = { x: 9, y: 9 };
    const next = mergeDiagram(blogDiagram(), imported, "replace");
    expect(next.layout.tables.users).toEqual({ x: 9, y: 9 });
  });
});

describe("mergeDiagram add", () => {
  test("adds the imported tables with new ids, renaming taken names", () => {
    const current = deepFreeze(blogDiagram());
    const next = mergeDiagram(current, edited(), "add");
    expect(next.tables.map((t) => t.name)).toEqual([
      "users",
      "posts",
      "USERS_2",
      "posts_2",
      "tags",
    ]);
    expect(next.tables.slice(0, 2)).toEqual(current.tables);
    expect(next.relations).toHaveLength(2);
    expect(next.layout.tables).toEqual(current.layout.tables);
    expect(validate(next)).toEqual([]);
  });

  test("adding the same project twice does not repeat ids", () => {
    const doc = blogDiagram();
    const next = mergeDiagram(doc, doc, "add");
    const ids = next.tables.flatMap((t) => [
      t.id,
      ...t.columns.map((c) => c.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(next.relations.map((r) => r.id)).size).toBe(2);
    expect(validate(next)).toEqual([]);
  });

  test("groups with the same name are merged", () => {
    const current = {
      ...blogDiagram(),
      groups: [createGroup({ id: "g", name: "Content" })],
    };
    const imported = edited();
    const group = createGroup({ name: "content" });
    imported.groups = [group, createGroup({ name: "Other" })];
    imported.tables[2] = { ...imported.tables[2]!, groupId: group.id };
    const next = mergeDiagram(current, imported, "add");
    expect(next.groups.map((g) => g.name)).toEqual(["Content", "Other"]);
    expect(byName(next, "tags").groupId).toBe("g");
  });

  test("enums: same values are reused, different values are renamed", () => {
    const current = {
      ...blogDiagram(),
      enums: [
        createEnum({ id: "a", name: "status", values: ["on", "off"] }),
        createEnum({ id: "b", name: "kind", values: ["x"] }),
      ],
    };
    const imported = edited();
    imported.enums = [
      createEnum({ name: "status", values: ["on", "off"] }),
      createEnum({ name: "kind", values: ["y"] }),
    ];
    imported.tables[2] = {
      ...imported.tables[2]!,
      columns: [
        ...imported.tables[2]!.columns,
        createColumn({ name: "k", type: "KIND" }),
        createColumn({ name: "s", type: "status" }),
      ],
    };
    const next = mergeDiagram(current, imported, "add");
    expect(next.enums.map((e) => e.name)).toEqual(["status", "kind", "kind_2"]);
    const tags = byName(next, "tags");
    expect(tags.columns.map((c) => c.type)).toEqual([
      "int",
      "kind_2",
      "status",
    ]);
  });
});
