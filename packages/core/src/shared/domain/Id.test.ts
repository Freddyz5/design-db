import { describe, expect, test } from "bun:test";
import { createId, IdSchema } from "./Id";

describe("Id", () => {
  test("createId returns a different id each time", () => {
    const ids = new Set(Array.from({ length: 50 }, createId));
    expect(ids.size).toBe(50);
  });

  test("an empty string is not a valid id", () => {
    expect(IdSchema.safeParse("").success).toBe(false);
    expect(IdSchema.safeParse(createId()).success).toBe(true);
  });
});
