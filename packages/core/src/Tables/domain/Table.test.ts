import { describe, expect, test } from "bun:test";
import { createColumn } from "../../Columns";
import { OperationError } from "../../shared";
import {
  createTable,
  getColumn,
  isUniqueKey,
  patchTable,
  TableSchema,
} from "./Table";

describe("createTable", () => {
  test("starts with no columns and no comment", () => {
    const table = createTable();
    expect(table.name).toBe("table");
    expect(table.columns).toEqual([]);
    expect("comment" in table).toBe(false);
    expect(TableSchema.safeParse(table).success).toBe(true);
  });
});

describe("patchTable", () => {
  test("renames and keeps the rest", () => {
    const table = Object.freeze(
      createTable({ name: "users", columns: [createColumn()] }),
    );
    expect(patchTable(table, { name: "accounts" })).toEqual({
      ...table,
      name: "accounts",
    });
  });

  test("sets and removes the comment", () => {
    const withComment = patchTable(createTable(), { comment: "People" });
    expect(withComment.comment).toBe("People");
    expect("comment" in patchTable(withComment, { comment: undefined })).toBe(
      false,
    );
  });

  test("ignores undefined on the name", () => {
    expect(
      patchTable(createTable({ name: "a" }), { name: undefined }).name,
    ).toBe("a");
  });
});

describe("getColumn", () => {
  const table = createTable({ columns: [createColumn({ id: "c1" })] });

  test("finds a column by id", () => {
    expect(getColumn(table, "c1").id).toBe("c1");
  });

  test("fails if the column does not exist", () => {
    expect(() => getColumn(table, "nope")).toThrow(OperationError);
  });
});

describe("isUniqueKey", () => {
  const table = createTable({
    columns: [
      createColumn({ id: "a", primaryKey: true }),
      createColumn({ id: "b", primaryKey: true }),
      createColumn({ id: "c", unique: true }),
      createColumn({ id: "d" }),
    ],
  });

  test("part of a composite primary key is not unique", () => {
    expect(isUniqueKey(table, ["a"])).toBe(false);
  });

  test("the whole composite primary key is unique", () => {
    expect(isUniqueKey(table, ["a", "b"])).toBe(true);
    expect(isUniqueKey(table, ["b", "a", "d"])).toBe(true);
  });

  test("a set with a unique column is unique", () => {
    expect(isUniqueKey(table, ["c"])).toBe(true);
    expect(isUniqueKey(table, ["c", "d"])).toBe(true);
  });

  test("a plain column is not unique", () => {
    expect(isUniqueKey(table, ["d"])).toBe(false);
  });
});
