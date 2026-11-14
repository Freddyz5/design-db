import { describe, expect, test } from "bun:test";
import { cssColorToHex } from "./cssColor";

describe("cssColorToHex", () => {
  test("rgb() as the browser reports it", () => {
    expect(cssColorToHex("rgb(44, 95, 142)")).toBe("#2c5f8e");
    expect(cssColorToHex("rgb(44 95 142)")).toBe("#2c5f8e");
    expect(cssColorToHex("rgba(255, 0, 0, 0.5)")).toBe("#ff0000");
  });

  test("a hex color stays, in lowercase", () => {
    expect(cssColorToHex("#2C5F8E")).toBe("#2c5f8e");
  });

  test("anything else gives the fallback", () => {
    expect(cssColorToHex("color(display-p3 1 0 0)", "#123456")).toBe("#123456");
  });
});
