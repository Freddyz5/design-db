import { describe, expect, test } from "bun:test";
import {
  createRelation,
  patchRelation,
  RelationSchema,
  usesColumn,
  usesTable,
} from "./Relation";

const postsToUsers = () =>
  Object.freeze(
    createRelation({
      id: "r",
      from: { tableId: "posts", columnIds: ["posts.user_id"] },
      to: { tableId: "users", columnIds: ["users.id"] },
    }),
  );

describe("createRelation", () => {
  test("defaults to no action and no name", () => {
    const relation = postsToUsers();
    expect(relation.onDelete).toBe("no action");
    expect(relation.onUpdate).toBe("no action");
    expect("name" in relation).toBe(false);
    expect(RelationSchema.safeParse(relation).success).toBe(true);
  });

  test("a relation needs at least one column per end", () => {
    const broken = { ...postsToUsers(), from: { tableId: "a", columnIds: [] } };
    expect(RelationSchema.safeParse(broken).success).toBe(false);
  });
});

describe("patchRelation", () => {
  test("changes the actions and keeps the ends", () => {
    const relation = postsToUsers();
    expect(
      patchRelation(relation, { onDelete: "cascade", onUpdate: "restrict" }),
    ).toEqual({ ...relation, onDelete: "cascade", onUpdate: "restrict" });
  });

  test("sets and removes the name", () => {
    const named = patchRelation(postsToUsers(), { name: "fk_posts_user" });
    expect(named.name).toBe("fk_posts_user");
    expect("name" in patchRelation(named, { name: undefined })).toBe(false);
  });
});

describe("usesTable / usesColumn", () => {
  const relation = postsToUsers();

  test("checks both ends", () => {
    expect(usesTable(relation, "posts")).toBe(true);
    expect(usesTable(relation, "users")).toBe(true);
    expect(usesTable(relation, "tags")).toBe(false);
  });

  test("a column only counts in its own table", () => {
    expect(usesColumn(relation, "posts", "posts.user_id")).toBe(true);
    expect(usesColumn(relation, "users", "users.id")).toBe(true);
    expect(usesColumn(relation, "users", "posts.user_id")).toBe(false);
    expect(usesColumn(relation, "posts", "posts.title")).toBe(false);
  });
});
