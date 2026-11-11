import { describe, expect, test } from "bun:test";
import { createColumn, type Column } from "../../Columns";
import { createTable } from "../../Tables";
import { createRelation, type Relation } from "./Relation";
import { getCardinality } from "./RelationCardinality";

/** users (id) <- posts (user_id), with the foreign key column customizable. */
function setup(foreignKey: Partial<Column> = {}) {
  const users = createTable({
    id: "users",
    columns: [createColumn({ id: "users.id", type: "int", primaryKey: true })],
  });
  const posts = createTable({
    id: "posts",
    columns: [
      createColumn({ id: "posts.id", primaryKey: true }),
      createColumn({ id: "posts.user_id", nullable: false, ...foreignKey }),
    ],
  });
  const relation = createRelation({
    from: { tableId: "posts", columnIds: ["posts.user_id"] },
    to: { tableId: "users", columnIds: ["users.id"] },
  });
  return { diagram: { tables: [users, posts] }, relation };
}

describe("getCardinality", () => {
  test("a plain foreign key is 1:N", () => {
    const { diagram, relation } = setup();
    expect(getCardinality(diagram, relation)).toEqual({
      kind: "1:N",
      optional: false,
    });
  });

  test("a unique foreign key is 1:1", () => {
    const { diagram, relation } = setup({ unique: true });
    expect(getCardinality(diagram, relation)?.kind).toBe("1:1");
  });

  test("a nullable foreign key is optional", () => {
    const { diagram, relation } = setup({ nullable: true });
    expect(getCardinality(diagram, relation)).toEqual({
      kind: "1:N",
      optional: true,
    });
  });

  test("a foreign key that is the whole primary key is 1:1", () => {
    const { diagram } = setup();
    const profiles = createTable({
      id: "profiles",
      columns: [createColumn({ id: "profiles.user_id", primaryKey: true })],
    });
    const relation = createRelation({
      from: { tableId: "profiles", columnIds: ["profiles.user_id"] },
      to: { tableId: "users", columnIds: ["users.id"] },
    });
    expect(
      getCardinality({ tables: [...diagram.tables, profiles] }, relation)?.kind,
    ).toBe("1:1");
  });

  test("returns null when the relation is broken", () => {
    const { diagram, relation } = setup();
    const missingColumn: Relation = {
      ...relation,
      to: { tableId: "users", columnIds: ["nope"] },
    };
    const missingTable: Relation = {
      ...relation,
      from: { tableId: "nope", columnIds: ["x"] },
    };
    expect(getCardinality(diagram, missingColumn)).toBeNull();
    expect(getCardinality(diagram, missingTable)).toBeNull();
  });
});
