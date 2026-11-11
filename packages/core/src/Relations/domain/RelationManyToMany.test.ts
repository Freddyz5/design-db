import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { OperationError } from "../../shared";
import { createTable, type Table } from "../../Tables";
import { planManyToMany } from "./RelationManyToMany";

const posts = (): Table =>
  createTable({
    id: "posts",
    name: "posts",
    columns: [
      createColumn({
        id: "posts.id",
        name: "id",
        type: "int",
        primaryKey: true,
      }),
      createColumn({ id: "posts.title", name: "title" }),
    ],
  });

const tags = (): Table =>
  createTable({
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
  });

describe("planManyToMany", () => {
  test("plans a join table with a composite primary key", () => {
    const { table } = planManyToMany(posts(), tags());
    expect(table.name).toBe("posts_tags");
    expect(table.columns.map((c) => [c.name, c.type])).toEqual([
      ["posts_id", "int"],
      ["tags_id", "uuid"],
    ]);
    expect(table.columns.every((c) => c.primaryKey && !c.nullable)).toBe(true);
  });

  test("plans one cascading relation from the join table to each table", () => {
    const { table, relations } = planManyToMany(posts(), tags());
    expect(
      relations.map((r) => [r.from.columnIds, r.to.tableId, r.to.columnIds]),
    ).toEqual([
      [[table.columns[0]!.id], "posts", ["posts.id"]],
      [[table.columns[1]!.id], "tags", ["tags.id"]],
    ]);
    expect(relations.every((r) => r.from.tableId === table.id)).toBe(true);
    expect(relations.every((r) => r.onDelete === "cascade")).toBe(true);
  });

  test("uses the given name and avoids names already taken, ignoring case", () => {
    expect(
      planManyToMany(posts(), tags(), { name: "post_tags" }).table.name,
    ).toBe("post_tags");
    expect(
      planManyToMany(posts(), tags(), { takenNames: ["POSTS_TAGS"] }).table
        .name,
    ).toBe("posts_tags_2");
  });

  test("works on the same table twice", () => {
    const users = createTable({
      name: "users",
      columns: [createColumn({ name: "id", primaryKey: true })],
    });
    const { table } = planManyToMany(users, users, { name: "follows" });
    expect(table.columns.map((c) => c.name)).toEqual([
      "users_id",
      "users_id_2",
    ]);
  });

  test("copies composite primary keys", () => {
    const composite: Table = {
      ...posts(),
      columns: posts().columns.map((c) => ({ ...c, primaryKey: true })),
    };
    const { table, relations } = planManyToMany(composite, tags());
    expect(table.columns.map((c) => c.name)).toEqual([
      "posts_id",
      "posts_title",
      "tags_id",
    ]);
    expect(relations[0].to.columnIds).toEqual(["posts.id", "posts.title"]);
  });

  test("fails if a table has no primary key", () => {
    const noKey: Table = { ...tags(), columns: [createColumn({ name: "id" })] };
    expect(() => planManyToMany(posts(), noKey)).toThrow(OperationError);
  });
});
