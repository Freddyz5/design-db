import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { createEnum } from "../../Enums";
import { createGroup } from "../../Groups";
import { createRelation } from "../../Relations";
import { createTable } from "../../Tables";
import type { Diagram } from "./Diagram";
import { blogDiagram, deepFreeze } from "./DiagramFixtures";
import { apply, applyAll } from "./DiagramOperations";
import { validate, type Issue } from "./DiagramValidation";

const codes = (issues: Issue[]) => issues.map((i) => i.code);

const rename = (doc: Diagram, tableId: string, name: string) =>
  apply(doc, { type: "table.update", tableId, patch: { name } });

describe("validate", () => {
  test("a correct diagram has no issues", () => {
    expect(validate(deepFreeze(blogDiagram()))).toEqual([]);
  });

  test("does not modify the diagram", () => {
    const doc = deepFreeze(rename(blogDiagram(), "posts", "users"));
    expect(() => validate(doc)).not.toThrow();
  });
});

describe("table checks", () => {
  test("empty table name is an error", () => {
    const issues = validate(rename(blogDiagram(), "users", "  "));
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "empty-table-name",
        severity: "error",
        tableId: "users",
      }),
    );
  });

  test("duplicate table names are reported on every table, ignoring case", () => {
    const issues = validate(rename(blogDiagram(), "posts", " USERS "));
    const duplicates = issues.filter((i) => i.code === "duplicate-table-name");
    expect(duplicates.map((i) => i.tableId)).toEqual(["users", "posts"]);
    expect(duplicates[0]!.severity).toBe("error");
  });

  test("empty and duplicate column names are errors", () => {
    const doc = applyAll(blogDiagram(), [
      {
        type: "column.update",
        tableId: "posts",
        columnId: "posts.title",
        patch: { name: "ID" },
      },
      {
        type: "column.add",
        tableId: "posts",
        column: createColumn({ id: "posts.blank", name: "" }),
      },
    ]);
    const issues = validate(doc);
    expect(
      issues
        .filter((i) => i.code === "duplicate-column-name")
        .map((i) => i.columnId),
    ).toEqual(["posts.id", "posts.title"]);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "empty-column-name",
        columnId: "posts.blank",
      }),
    );
  });

  test("a table without primary key is a warning", () => {
    const doc = apply(blogDiagram(), {
      type: "table.add",
      table: createTable({ id: "logs", name: "logs" }),
    });
    expect(validate(doc)).toEqual([
      expect.objectContaining({
        code: "table-without-primary-key",
        severity: "warning",
        tableId: "logs",
      }),
    ]);
  });

  test("a nullable primary key column is a warning", () => {
    const doc = apply(blogDiagram(), {
      type: "column.update",
      tableId: "users",
      columnId: "users.id",
      patch: { nullable: true },
    });
    expect(codes(validate(doc))).toEqual(["nullable-primary-key"]);
  });
});

describe("relation checks", () => {
  /** Puts a relation in the diagram without the checks done by `apply`. */
  const withRelation = (
    relation: Parameters<typeof createRelation>[0],
  ): Diagram => {
    const doc = blogDiagram();
    return { ...doc, relations: [createRelation({ id: "r", ...relation })] };
  };

  test("a relation to a missing table is an error", () => {
    const doc = withRelation({
      from: { tableId: "posts", columnIds: ["posts.user_id"] },
      to: { tableId: "gone", columnIds: ["gone.id"] },
    });
    expect(validate(doc)).toEqual([
      expect.objectContaining({
        code: "relation-missing-table",
        severity: "error",
        relationId: "r",
        tableId: "gone",
      }),
    ]);
  });

  test("a relation to a missing column is an error", () => {
    const doc = withRelation({
      from: { tableId: "posts", columnIds: ["posts.gone"] },
      to: { tableId: "users", columnIds: ["users.id"] },
    });
    expect(validate(doc)).toEqual([
      expect.objectContaining({
        code: "relation-missing-column",
        columnId: "posts.gone",
      }),
    ]);
  });

  test("a different number of columns on each end is an error", () => {
    const doc = withRelation({
      from: { tableId: "posts", columnIds: ["posts.user_id", "posts.id"] },
      to: { tableId: "users", columnIds: ["users.id"] },
    });
    expect(codes(validate(doc))).toEqual(["relation-column-count"]);
  });

  test("pointing at columns that are not unique is a warning", () => {
    const doc = withRelation({
      from: { tableId: "posts", columnIds: ["posts.title"] },
      to: { tableId: "users", columnIds: ["users.email"] },
    });
    const issues = validate(doc);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "relation-target-not-unique",
        severity: "warning",
        tableId: "users",
      }),
    );
  });

  test("different types on both ends is a warning", () => {
    const doc = apply(blogDiagram(), {
      type: "column.update",
      tableId: "posts",
      columnId: "posts.user_id",
      patch: { type: "bigint" },
    });
    expect(validate(doc)).toEqual([
      expect.objectContaining({
        code: "relation-type-mismatch",
        severity: "warning",
        relationId: "posts_user",
        columnId: "posts.user_id",
      }),
    ]);
  });

  test("types are compared ignoring case and extra spaces", () => {
    const doc = applyAll(blogDiagram(), [
      {
        type: "column.update",
        tableId: "users",
        columnId: "users.id",
        patch: { type: "INT  UNSIGNED" },
      },
      {
        type: "column.update",
        tableId: "posts",
        columnId: "posts.user_id",
        patch: { type: "int unsigned" },
      },
    ]);
    expect(validate(doc)).toEqual([]);
  });
});

describe("group checks", () => {
  const withGroups = (...names: string[]): Diagram => ({
    ...blogDiagram(),
    groups: names.map((name, i) => createGroup({ id: `g${i}`, name })),
  });

  test("empty and duplicate group names are errors", () => {
    const issues = validate(withGroups(" ", "Core", "core"));
    expect(issues).toContainEqual(
      expect.objectContaining({ code: "empty-group-name", groupId: "g0" }),
    );
    expect(
      issues
        .filter((i) => i.code === "duplicate-group-name")
        .map((i) => i.groupId),
    ).toEqual(["g1", "g2"]);
  });

  test("a table in a group that does not exist is an error", () => {
    const doc = blogDiagram();
    const broken: Diagram = {
      ...doc,
      tables: [{ ...doc.tables[0]!, groupId: "gone" }, doc.tables[1]!],
    };
    expect(validate(broken)).toEqual([
      expect.objectContaining({
        code: "table-missing-group",
        severity: "error",
        tableId: "users",
        groupId: "gone",
      }),
    ]);
  });
});

describe("enum checks", () => {
  const withEnums = (
    ...items: Parameters<typeof createEnum>[0][]
  ): Diagram => ({
    ...blogDiagram(),
    enums: items.map((item, i) => createEnum({ id: `e${i}`, ...item })),
  });

  test("a correct enum has no issues", () => {
    expect(validate(withEnums({ name: "status", values: ["a", "b"] }))).toEqual(
      [],
    );
  });

  test("empty and duplicate enum names are errors", () => {
    const issues = validate(
      withEnums(
        { name: "", values: ["a"] },
        { name: "status", values: ["a"] },
        { name: "STATUS", values: ["a"] },
      ),
    );
    expect(codes(issues)).toEqual([
      "empty-enum-name",
      "duplicate-enum-name",
      "duplicate-enum-name",
    ]);
  });

  test("an enum without values is a warning", () => {
    expect(validate(withEnums({ name: "status" }))).toEqual([
      expect.objectContaining({
        code: "enum-without-values",
        severity: "warning",
        enumId: "e0",
      }),
    ]);
  });

  test("a repeated value is an error, reported once", () => {
    const issues = validate(
      withEnums({ name: "status", values: ["a", "b", "a", "a"] }),
    );
    expect(issues).toEqual([
      expect.objectContaining({
        code: "duplicate-enum-value",
        severity: "error",
      }),
    ]);
  });
});
