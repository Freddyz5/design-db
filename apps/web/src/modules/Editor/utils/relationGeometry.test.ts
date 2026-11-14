import { describe, expect, test } from "bun:test";
import { childMark, parentMarks, relationCurve } from "./relationGeometry";

describe("relationCurve", () => {
  test("between facing sides it bends with the distance", () => {
    expect(
      relationCurve({ x: 0, y: 10, out: 1 }, { x: 200, y: 50, out: -1 }),
    ).toBe("M0 10 C90 10 110 50 200 50");
  });

  test("a short gap still bends at least 40", () => {
    expect(
      relationCurve({ x: 0, y: 0, out: 1 }, { x: 20, y: 0, out: -1 }),
    ).toBe("M0 0 C40 0 -20 0 20 0");
  });

  test("on the same side it loops out with the height", () => {
    expect(
      relationCurve({ x: 300, y: 0, out: 1 }, { x: 300, y: 400, out: 1 }),
    ).toBe("M300 0 C388 0 388 400 300 400");
  });

  test("a table related to itself loops out further", () => {
    expect(
      relationCurve({ x: 300, y: 0, out: 1 }, { x: 300, y: 100, out: 1 }, true),
    ).toBe("M300 0 C365 0 365 100 300 100");
  });
});

describe("marks", () => {
  test("many is a crow's foot, one a bar", () => {
    expect(childMark({ x: 0, y: 10, out: 1 }, true)).toBe("M0 4 L11 10 L0 16");
    expect(childMark({ x: 0, y: 10, out: -1 }, false)).toBe("M-9 4 V16");
  });

  test("the parent end has two bars, or a bar and a circle when optional", () => {
    expect(parentMarks({ x: 100, y: 0, out: -1 }, false)).toEqual({
      path: "M94 -6 V6 M89 -6 V6",
      circle: null,
    });
    expect(parentMarks({ x: 100, y: 0, out: -1 }, true)).toEqual({
      path: "M94 -6 V6",
      circle: { cx: 86, cy: 0 },
    });
  });
});
