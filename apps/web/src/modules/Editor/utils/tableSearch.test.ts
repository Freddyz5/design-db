import { describe, expect, test } from "bun:test";
import { createExampleDiagram } from "@design-db/core";
import { moveActive, searchItems } from "./tableSearch";

describe("searchItems", () => {
  const diagram = createExampleDiagram();

  test("tables whose name starts with the query come first, then those with a matching column", () => {
    // comments has post_id.
    expect(searchItems(diagram, "po").map((item) => item.name)).toEqual([
      "posts",
      "posts_tags",
      "comments",
    ]);
  });

  test("a table found by a column says which column", () => {
    const items = searchItems(diagram, "email");
    expect(items).toEqual([
      expect.objectContaining({ name: "users", hint: "columna email" }),
    ]);
  });

  test("by name there is no hint, and an empty query finds nothing", () => {
    expect(searchItems(diagram, "tags")[0]!.hint).toBe("");
    expect(searchItems(diagram, "  ")).toEqual([]);
  });

  test("ignores case and accents", () => {
    expect(searchItems(diagram, "COMMÉNTS").map((item) => item.name)).toEqual([
      "comments",
    ]);
  });
});

describe("moveActive", () => {
  test("goes down and up, wrapping around", () => {
    expect(moveActive(-1, 1, 3)).toBe(0);
    expect(moveActive(-1, -1, 3)).toBe(2);
    expect(moveActive(2, 1, 3)).toBe(0);
    expect(moveActive(0, -1, 3)).toBe(2);
    expect(moveActive(1, 1, 0)).toBe(-1);
  });
});
