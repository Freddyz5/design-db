import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { OperationError } from "../../shared";
import { createTable, type Table } from "./Table";
import {
  addColumn,
  moveColumn,
  removeColumn,
  updateColumn,
} from "./TableColumns";

/** posts (id, user_id, title), frozen so changes must return copies. */
function posts(): Table {
  return Object.freeze(
    createTable({
      id: "posts",
      name: "posts",
      columns: [
        createColumn({ id: "id", name: "id", primaryKey: true }),
        createColumn({ id: "user_id", name: "user_id" }),
        createColumn({ id: "title", name: "title" }),
      ],
    }),
  );
}

const names = (table: Table) => table.columns.map((c) => c.name);

describe("addColumn", () => {
  test("adds the column at the end by default", () => {
    const next = addColumn(posts(), createColumn({ name: "body" }));
    expect(names(next)).toEqual(["id", "user_id", "title", "body"]);
  });

  test("adds the column at the given index", () => {
    const next = addColumn(posts(), createColumn({ name: "body" }), 1);
    expect(names(next)).toEqual(["id", "body", "user_id", "title"]);
  });

  test("clamps an out-of-range index", () => {
    expect(names(addColumn(posts(), createColumn({ name: "a" }), -5))[0]).toBe(
      "a",
    );
    expect(
      names(addColumn(posts(), createColumn({ name: "z" }), 99)).at(-1),
    ).toBe("z");
  });

  test("fails if the column id is already in the table", () => {
    expect(() => addColumn(posts(), createColumn({ id: "id" }))).toThrow(
      OperationError,
    );
  });
});

describe("updateColumn", () => {
  test("changes only that column", () => {
    const table = posts();
    const next = updateColumn(table, "title", { name: "headline" });
    expect(names(next)).toEqual(["id", "user_id", "headline"]);
    expect(next.columns[0]).toBe(table.columns[0]!);
  });

  test("fails if the column does not exist", () => {
    expect(() => updateColumn(posts(), "nope", { name: "x" })).toThrow(
      OperationError,
    );
  });
});

describe("moveColumn", () => {
  test("moves a column down", () => {
    expect(names(moveColumn(posts(), "id", 2))).toEqual([
      "user_id",
      "title",
      "id",
    ]);
  });

  test("moves a column up", () => {
    expect(names(moveColumn(posts(), "title", 0))).toEqual([
      "title",
      "id",
      "user_id",
    ]);
  });

  test("clamps an out-of-range index", () => {
    expect(names(moveColumn(posts(), "id", 99))).toEqual([
      "user_id",
      "title",
      "id",
    ]);
  });

  test("fails if the column does not exist", () => {
    expect(() => moveColumn(posts(), "nope", 0)).toThrow(OperationError);
  });
});

describe("removeColumn", () => {
  test("removes the column", () => {
    expect(names(removeColumn(posts(), "title"))).toEqual(["id", "user_id"]);
  });

  test("fails if the column does not exist", () => {
    expect(() => removeColumn(posts(), "nope")).toThrow(OperationError);
  });
});
