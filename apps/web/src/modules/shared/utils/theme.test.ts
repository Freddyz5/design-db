import { describe, expect, test } from "bun:test";
import { parseTheme, themeAttribute } from "./theme";

describe("parseTheme", () => {
  test("keeps a known theme", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  test("falls back to system for anything else", () => {
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("")).toBe("system");
    expect(parseTheme("sepia")).toBe("system");
    expect(parseTheme(1)).toBe("system");
  });
});

describe("themeAttribute", () => {
  test("forces light or dark, and leaves system to the browser", () => {
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("system")).toBeUndefined();
  });
});
