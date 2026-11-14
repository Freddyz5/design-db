import { describe, expect, test } from "bun:test";
import { GROUP_COLOR_KEYS, groupColor, stripColors } from "./groupColor";

describe("groupColor", () => {
  test("a palette key uses the theme token", () => {
    expect(groupColor("blue")).toBe("var(--color-group-1)");
    expect(groupColor("slate")).toBe("var(--color-group-8)");
  });

  test("a hex color is used as is", () => {
    expect(groupColor("#2c5f8e")).toBe("#2c5f8e");
  });

  test("no color, or one that is not understood, gives the sheet's ink", () => {
    expect(groupColor(undefined)).toBe("var(--color-sheet-edge)");
    expect(groupColor("teal-ish")).toBe("var(--color-sheet-edge)");
    expect(groupColor("#12")).toBe("var(--color-sheet-edge)");
  });
});

describe("stripColors", () => {
  test("a color gives a tint of it with the name in that color", () => {
    expect(stripColors("blue")).toEqual({
      background:
        "color-mix(in srgb, var(--color-group-1) 16%, var(--color-sheet))",
      ink: "color-mix(in srgb, var(--color-group-1) 70%, var(--color-sheet-ink))",
    });
    expect(stripColors("#2c5f8e").background).toContain("#2c5f8e");
  });

  test("no color gives the neutral header", () => {
    expect(stripColors(undefined)).toEqual({
      background: "var(--color-sheet-head)",
      ink: "var(--color-sheet-head-ink)",
    });
  });
});
