import { describe, expect, test } from "bun:test";
import { createEnum, EnumSchema, isEnumType, patchEnum } from "./Enum";

describe("createEnum", () => {
  test("starts with no values and no note", () => {
    const status = createEnum({ name: "status" });
    expect(status.values).toEqual([]);
    expect("note" in status).toBe(false);
    expect(EnumSchema.safeParse(status).success).toBe(true);
  });
});

describe("patchEnum", () => {
  test("changes the values and removes the note", () => {
    const status = Object.freeze(
      createEnum({ name: "status", values: ["a"], note: "x" }),
    );
    const next = patchEnum(status, { values: ["a", "b"], note: undefined });
    expect(next.values).toEqual(["a", "b"]);
    expect("note" in next).toBe(false);
    expect(status.values).toEqual(["a"]);
  });
});

describe("isEnumType", () => {
  test("compares the name ignoring case and spaces", () => {
    const status = createEnum({ name: "post_status" });
    expect(isEnumType(status, "POST_STATUS ")).toBe(true);
    expect(isEnumType(status, "text")).toBe(false);
  });
});
