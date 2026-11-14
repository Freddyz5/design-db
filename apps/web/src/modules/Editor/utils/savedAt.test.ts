import { describe, expect, test } from "bun:test";
import { savedAt } from "./savedAt";

describe("savedAt", () => {
  const now = new Date(2026, 10, 14, 18, 0);

  test("today shows the time", () => {
    expect(savedAt(new Date(2026, 10, 14, 9, 5).toISOString(), now)).toMatch(
      /09:05/,
    );
  });

  test("another day shows the day and month", () => {
    expect(savedAt(new Date(2026, 10, 2, 9, 5).toISOString(), now)).toMatch(
      /^2 nov/,
    );
  });

  test("a broken date shows nothing", () => {
    expect(savedAt("nope", now)).toBe("");
  });
});
