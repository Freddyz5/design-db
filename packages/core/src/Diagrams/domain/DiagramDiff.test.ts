import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { createEnum } from "../../Enums";
import { createGroup } from "../../Groups";
import { createTable } from "../../Tables";
import { createDiagram } from "./Diagram";
import { diffDiagram } from "./DiagramDiff";
import { blogDiagram, deepFreeze } from "./DiagramFixtures";
import { mergeDiagram } from "./DiagramMerge";
import { apply, applyAll } from "./DiagramOperations";

const AT = "2026-11-11T10:00:00.000Z";
const withBase = () => apply(blogDiagram(), { type: "base.set", at: AT });

describe("base.set / base.clear", () => {
  test("base.set keeps a copy of the schema and the date", () => {
    const doc = deepFreeze(blogDiagram());
    const next = apply(doc, { type: "base.set", at: AT });
    expect(next.base).toEqual({
      at: AT,
      tables: doc.tables,
      relations: doc.relations,
      groups: [],
      enums: [],
    });
  });

  test("later changes do not touch the base", () => {
    const next = apply(withBase(), {
      type: "table.update",
      tableId: "users",
      patch: { name: "accounts" },
    });
    expect(next.base!.tables[0]!.name).toBe("users");
  });

  test("base.clear removes it", () => {
    const next = apply(withBase(), { type: "base.clear" });
    expect("base" in next).toBe(false);
  });

  test("merging an import keeps the base", () => {
    const doc = withBase();
    expect(mergeDiagram(doc, createDiagram(), "replace").base).toBe(doc.base);
  });
});

describe("diffDiagram", () => {
  test("is null without a base and empty right after setting it", () => {
    expect(diffDiagram(blogDiagram())).toBeNull();
    expect(diffDiagram(withBase())).toEqual([]);
  });

  test("lists added, modified and removed items", () => {
    const next = applyAll(withBase(), [
      {
        type: "table.update",
        tableId: "users",
        patch: { name: "accounts", comment: "x" },
      },
      {
        type: "column.update",
        tableId: "posts",
        columnId: "posts.title",
        patch: { type: "varchar(200)", nullable: false },
      },
      { type: "column.remove", tableId: "users", columnId: "users.email" },
      {
        type: "column.add",
        tableId: "users",
        column: createColumn({ id: "users.name", name: "name" }),
      },
      {
        type: "relation.update",
        relationId: "posts_user",
        patch: { onDelete: "cascade" },
      },
      {
        type: "table.add",
        table: createTable({ id: "tags", name: "tags" }),
      },
      { type: "group.add", group: createGroup({ id: "g", name: "Core" }) },
      { type: "enum.add", enum: createEnum({ id: "e", name: "status" }) },
    ]);
    expect(diffDiagram(next)).toEqual([
      {
        entity: "table",
        kind: "modified",
        tableId: "users",
        name: "accounts",
        fields: ["name", "comment"],
      },
      {
        entity: "column",
        kind: "added",
        tableId: "users",
        columnId: "users.name",
        name: "name",
      },
      {
        entity: "column",
        kind: "removed",
        tableId: "users",
        columnId: "users.email",
        name: "email",
      },
      {
        entity: "column",
        kind: "modified",
        tableId: "posts",
        columnId: "posts.title",
        name: "title",
        fields: ["type", "nullable"],
      },
      { entity: "table", kind: "added", tableId: "tags", name: "tags" },
      {
        entity: "relation",
        kind: "modified",
        relationId: "posts_user",
        fields: ["onDelete"],
      },
      { entity: "group", kind: "added", groupId: "g", name: "Core" },
      { entity: "enum", kind: "added", enumId: "e", name: "status" },
    ]);
  });

  test("a removed table removes its relations, listed once each", () => {
    const next = apply(withBase(), { type: "table.remove", tableId: "users" });
    expect(diffDiagram(next)).toEqual([
      { entity: "table", kind: "removed", tableId: "users", name: "users" },
      { entity: "relation", kind: "removed", relationId: "posts_user" },
    ]);
  });

  test("moving tables is not a change", () => {
    const next = apply(withBase(), {
      type: "table.move",
      tableId: "users",
      position: { x: 50, y: 50 },
    });
    expect(diffDiagram(next)).toEqual([]);
  });
});
