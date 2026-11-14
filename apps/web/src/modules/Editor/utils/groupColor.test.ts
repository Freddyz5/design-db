import { describe, expect, test } from "bun:test";
import { groupColor, isHexColor, stripColors, zoneColors } from "./groupColor";

describe("groupColor", () => {
  test("a palette key uses the theme token", () => {
    expect(groupColor("blue")).toBe("var(--color-group-1)");
    expect(groupColor("slate")).toBe("var(--color-group-8)");
  });

  test("a hex color is used as is on paper and lightened at night", () => {
    expect(groupColor("#2c5f8e")).toBe(
      "light-dark(#2c5f8e, color-mix(in oklab, #2c5f8e 55%, #ffffff))",
    );
  });

  test("no color, or one that is not understood, gives the sheet's ink", () => {
    expect(groupColor(undefined)).toBe("var(--color-sheet-edge)");
    expect(groupColor("teal-ish")).toBe("var(--color-sheet-edge)");
    expect(groupColor("#12")).toBe("var(--color-sheet-edge)");
  });
});

describe("isHexColor", () => {
  test("only hex colors", () => {
    expect(isHexColor("#2c5f8e")).toBe(true);
    expect(isHexColor("#abc")).toBe(true);
    expect(isHexColor("blue")).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
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

  test("the intensity scales the tint, within readable bounds", () => {
    expect(stripColors("blue", 1.5).background).toContain(" 24%,");
    expect(stripColors("blue", 2).background).toContain(" 32%,");
    expect(stripColors("blue", 0.1).background).toContain(" 5%,");
    expect(stripColors("blue", 2).ink).toBe(stripColors("blue").ink);
  });

  test("no color gives the neutral header", () => {
    expect(stripColors(undefined)).toEqual({
      background: "var(--color-sheet-head)",
      ink: "var(--color-sheet-head-ink)",
    });
  });
});

describe("zoneColors", () => {
  test("the default is a 75% outline and a 5% fill", () => {
    expect(zoneColors("red")).toEqual({
      border: "color-mix(in srgb, red 75%, transparent)",
      fill: "color-mix(in srgb, red 5%, transparent)",
    });
  });

  test("more intensity, a stronger outline and fill; less, fainter", () => {
    expect(zoneColors("red", 2)).toEqual({
      border: "color-mix(in srgb, red 100%, transparent)",
      fill: "color-mix(in srgb, red 14%, transparent)",
    });
    expect(zoneColors("red", 0.5)).toEqual({
      border: "color-mix(in srgb, red 60%, transparent)",
      fill: "color-mix(in srgb, red 1.8%, transparent)",
    });
  });
});
