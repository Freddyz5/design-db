import { describe, expect, test } from "bun:test";
import { isSameColumnType, suggestedColumnTypes } from "./ColumnTypes";

describe("suggestedColumnTypes", () => {
  test("depends on the dialect", () => {
    expect(suggestedColumnTypes("postgres")).toContain("jsonb");
    expect(suggestedColumnTypes("mysql")).toContain("datetime");
    expect(suggestedColumnTypes("sqlite")).toEqual([
      "integer",
      "real",
      "text",
      "blob",
      "numeric",
    ]);
  });

  test("returns a copy that can be changed safely", () => {
    suggestedColumnTypes("generic").push("custom");
    expect(suggestedColumnTypes("generic")).not.toContain("custom");
  });
});

describe("isSameColumnType", () => {
  test("ignores case and extra spaces", () => {
    expect(isSameColumnType("VARCHAR(255)", "varchar(255)")).toBe(true);
    expect(isSameColumnType("double  precision", "double precision")).toBe(
      true,
    );
  });

  test("int and integer, and a serial key and its integer foreign key, are the same", () => {
    expect(isSameColumnType("int", "integer")).toBe(true);
    expect(isSameColumnType("serial", "integer")).toBe(true);
    expect(isSameColumnType("bigserial", "BIGINT")).toBe(true);
    expect(isSameColumnType("smallserial", "smallint")).toBe(true);
  });

  test("different types are different", () => {
    expect(isSameColumnType("int", "bigint")).toBe(false);
    expect(isSameColumnType("varchar(100)", "varchar(255)")).toBe(false);
  });
});
