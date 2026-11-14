import { describe, expect, test } from "bun:test";
import { GROUP_COLOR_KEYS, stripColors } from "./groupColor";

describe("stripColors", () => {
  test("a palette key uses its theme token", () => {
    expect(stripColors("blue")).toEqual({
      background: "var(--color-group-1)",
      ink: "var(--color-on-group)",
    });
    expect(stripColors("slate").background).toBe("var(--color-group-8)");
    expect(GROUP_COLOR_KEYS).toHaveLength(8);
  });

  test("a hex color is used as is, with the ink that reads on it", () => {
    expect(stripColors("#2c5f8e")).toEqual({
      background: "#2c5f8e",
      ink: "#ffffff",
    });
    expect(stripColors("#FFE680").ink).toBe("#0b0b0d");
    expect(stripColors("#fff").ink).toBe("#0b0b0d");
    expect(stripColors("#000").ink).toBe("#ffffff");
  });

  test("no color, or one that is not understood, gives the neutral strip", () => {
    const neutral = {
      background: "var(--color-flap-edge)",
      ink: "var(--color-on-group)",
    };
    expect(stripColors(undefined)).toEqual(neutral);
    expect(stripColors("teal-ish")).toEqual(neutral);
    expect(stripColors("#12")).toEqual(neutral);
  });
});
