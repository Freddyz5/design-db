import { describe, expect, test } from "bun:test";
import { drawingScale } from "./drawingScale";

describe("drawingScale", () => {
  test("the real size is 1 : 1", () => {
    expect(drawingScale(1)).toBe("1 : 1");
    expect(drawingScale(1.001)).toBe("1 : 1");
  });

  test("smaller than real reads 1 : n", () => {
    expect(drawingScale(0.5)).toBe("1 : 2");
    expect(drawingScale(0.58)).toBe("1 : 1,7");
  });

  test("bigger than real reads n : 1", () => {
    expect(drawingScale(2)).toBe("2 : 1");
    expect(drawingScale(1.5)).toBe("1,5 : 1");
  });

  test("a zoom that makes no sense gives nothing", () => {
    expect(drawingScale(0)).toBe("");
  });
});
