import { describe, expect, test } from "bun:test";
import { ColumnSchema, createColumn, patchColumn } from "./Column";

describe("createColumn", () => {
  test("uses sensible defaults", () => {
    const column = createColumn();
    expect(column).toMatchObject({
      name: "column",
      type: "text",
      primaryKey: false,
      nullable: true,
      unique: false,
      autoIncrement: false,
    });
    expect(ColumnSchema.safeParse(column).success).toBe(true);
  });

  test("columns are nullable unless they are a primary key", () => {
    expect(createColumn().nullable).toBe(true);
    expect(createColumn({ primaryKey: true }).nullable).toBe(false);
    expect(createColumn({ primaryKey: true, nullable: true }).nullable).toBe(
      true,
    );
  });

  test("optional fields are left out when not given", () => {
    expect("default" in createColumn()).toBe(false);
    expect("comment" in createColumn()).toBe(false);
    expect(createColumn({ default: "0" }).default).toBe("0");
  });
});

describe("patchColumn", () => {
  test("changes only the given fields", () => {
    const column = Object.freeze(createColumn({ name: "email" }));
    const next = patchColumn(column, { unique: true, nullable: false });
    expect(next).toEqual({ ...column, unique: true, nullable: false });
  });

  test("sets and removes the default value", () => {
    const withDefault = patchColumn(createColumn(), { default: "''" });
    expect(withDefault.default).toBe("''");
    const without = patchColumn(withDefault, { default: undefined });
    expect("default" in without).toBe(false);
  });
});
