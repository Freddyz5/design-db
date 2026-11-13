import { describe, expect, test } from "bun:test";
import {
  apply,
  createColumn,
  createDiagram,
  createTable,
  getCardinality,
  validate,
  type Diagram,
} from "@design-db/core";
import {
  canRelateManyToMany,
  linkColumns,
  relateManyToMany,
} from "./relationEdits";

/** users(id serial PK, email) at (0, 0) and posts(id PK, author, title) at (400, 100). */
function blog(): Diagram {
  const users = createTable({
    id: "users",
    name: "users",
    columns: [
      createColumn({
        id: "users.id",
        name: "id",
        type: "serial",
        primaryKey: true,
      }),
      createColumn({
        id: "users.email",
        name: "email",
        type: "varchar(255)",
        unique: true,
      }),
    ],
  });
  const posts = createTable({
    id: "posts",
    name: "posts",
    columns: [
      createColumn({
        id: "posts.id",
        name: "id",
        type: "serial",
        primaryKey: true,
      }),
      createColumn({ id: "posts.author", name: "author", type: "text" }),
      createColumn({ id: "posts.title", name: "title", type: "text" }),
    ],
  });
  let diagram = createDiagram();
  diagram = apply(diagram, {
    type: "table.add",
    table: users,
    position: { x: 0, y: 0 },
  });
  diagram = apply(diagram, {
    type: "table.add",
    table: posts,
    position: { x: 400, y: 100 },
  });
  return diagram;
}

const ends = (diagram: Diagram) =>
  diagram.relations.map((r) => [
    `${r.from.tableId}:${r.from.columnIds}`,
    `${r.to.tableId}:${r.to.columnIds}`,
  ]);

describe("linkColumns", () => {
  test("a column dropped on a table points at its primary key", () => {
    const edit = linkColumns(
      blog(),
      { tableId: "posts", columnId: "posts.author" },
      { tableId: "users" },
    )!;
    expect(ends(edit.diagram)).toEqual([
      ["posts:posts.author", "users:users.id"],
    ]);
    expect(edit.diagram.tables[1]!.columns[1]!.type).toBe("integer");
    expect(edit.notice).toBe("Relación posts.author → users.id.");
    expect(validate(edit.diagram)).toEqual([]);
  });

  test("a column dropped on a column points at that column", () => {
    const edit = linkColumns(
      blog(),
      { tableId: "posts", columnId: "posts.author" },
      { tableId: "users", columnId: "users.email" },
    )!;
    expect(ends(edit.diagram)).toEqual([
      ["posts:posts.author", "users:users.email"],
    ]);
    expect(edit.diagram.tables[1]!.columns[1]!.type).toBe("varchar(255)");
  });

  test("the primary key dropped on a table gives that table a new foreign key", () => {
    const edit = linkColumns(
      blog(),
      { tableId: "users", columnId: "users.id" },
      { tableId: "posts" },
    )!;
    const added = edit.diagram.tables[1]!.columns.at(-1)!;
    expect(added).toMatchObject({
      name: "users_id",
      type: "integer",
      nullable: false,
    });
    expect(ends(edit.diagram)).toEqual([
      [`posts:${added.id}`, "users:users.id"],
    ]);
    expect(edit.notice).toBe("Nueva columna posts.users_id → users.id.");
    expect(getCardinality(edit.diagram, edit.diagram.relations[0]!)).toEqual({
      kind: "1:N",
      optional: false,
    });
  });

  test("the new foreign key avoids a column name already in use", () => {
    const taken = apply(blog(), {
      type: "column.add",
      tableId: "posts",
      column: createColumn({ name: "Users_ID" }),
    });
    const edit = linkColumns(
      taken,
      { tableId: "users", columnId: "users.id" },
      { tableId: "posts" },
    )!;
    expect(edit.diagram.tables[1]!.columns.at(-1)!.name).toBe("users_id_2");
  });

  test("the primary key dropped on a plain column makes that column the foreign key", () => {
    const edit = linkColumns(
      blog(),
      { tableId: "users", columnId: "users.id" },
      { tableId: "posts", columnId: "posts.author" },
    )!;
    expect(ends(edit.diagram)).toEqual([
      ["posts:posts.author", "users:users.id"],
    ]);
    expect(edit.notice).toBe("Relación posts.author → users.id.");
  });

  test("a table can point at itself", () => {
    const edit = linkColumns(
      blog(),
      { tableId: "posts", columnId: "posts.author" },
      { tableId: "posts" },
    )!;
    expect(ends(edit.diagram)).toEqual([
      ["posts:posts.author", "posts:posts.id"],
    ]);
  });

  test("nothing to relate: a column on itself, or something that is gone", () => {
    const diagram = blog();
    expect(
      linkColumns(
        diagram,
        { tableId: "users", columnId: "users.id" },
        { tableId: "users" },
      ),
    ).toBeNull();
    expect(
      linkColumns(
        diagram,
        { tableId: "posts", columnId: "posts.title" },
        { tableId: "posts", columnId: "posts.title" },
      ),
    ).toBeNull();
    expect(
      linkColumns(
        diagram,
        { tableId: "posts", columnId: "nope" },
        { tableId: "users" },
      ),
    ).toBeNull();
    expect(
      linkColumns(
        diagram,
        { tableId: "posts", columnId: "posts.author" },
        { tableId: "nope" },
      ),
    ).toBeNull();
  });
});

describe("relateManyToMany", () => {
  test("adds a join table under the two tables, between them", () => {
    const edit = relateManyToMany(blog(), "users", "posts");
    const join = edit.diagram.tables.find((t) => t.id === edit.tableId)!;
    expect(join.name).toBe("users_posts");
    expect(edit.diagram.relations).toHaveLength(2);
    // posts starts at y 100 and is 30 + 3 * 24 + 3 = 105 tall; 48 under it.
    expect(edit.diagram.layout.tables[edit.tableId]).toEqual({
      x: 200,
      y: 253,
    });
    expect(edit.notice).toBe(
      "Nueva tabla users_posts para la relación de muchos a muchos.",
    );
  });

  test("needs a primary key in both tables", () => {
    const diagram = apply(blog(), {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.id",
      patch: { primaryKey: false },
    });
    const [users, posts] = diagram.tables;
    expect(canRelateManyToMany(users!, posts!)).toBe(false);
    expect(canRelateManyToMany(users!, blog().tables[1]!)).toBe(true);
  });
});
