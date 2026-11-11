import { describe, expect, test } from "bun:test";
import { applyPatch } from "./applyPatch";

type Item = { name: string; note?: string };

describe("applyPatch", () => {
  test("merges the given fields into a copy", () => {
    const base: Item = Object.freeze({ name: "a" });
    const next = applyPatch(base, { name: "b", note: "x" }, ["note"]);
    expect(next).toEqual({ name: "b", note: "x" });
    expect(base).toEqual({ name: "a" });
  });

  test("undefined removes an optional field", () => {
    const next = applyPatch<Item>(
      { name: "a", note: "x" },
      { note: undefined },
      ["note"],
    );
    expect("note" in next).toBe(false);
  });

  test("undefined on a required field is ignored", () => {
    const next = applyPatch<Item>({ name: "a" }, { name: undefined }, ["note"]);
    expect(next).toEqual({ name: "a" });
  });
});
