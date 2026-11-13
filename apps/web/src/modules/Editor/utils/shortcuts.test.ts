import { describe, expect, test } from "bun:test";
import {
  nudgeFor,
  shortcutFor,
  shortcutList,
  type KeyPress,
} from "./shortcuts";

const press = (key: string, mods: Partial<KeyPress> = {}): KeyPress => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  ...mods,
});

describe("shortcutFor", () => {
  test("single keys", () => {
    expect(shortcutFor(press("n"))).toBe("newTable");
    expect(shortcutFor(press("N", { shiftKey: false }))).toBe("newTable");
    expect(shortcutFor(press("f"))).toBe("fitView");
    expect(shortcutFor(press("c"))).toBe("toggleCode");
    expect(shortcutFor(press("Enter"))).toBe("editTable");
    expect(shortcutFor(press("Delete"))).toBe("delete");
    expect(shortcutFor(press("Backspace"))).toBe("delete");
    expect(shortcutFor(press("Escape"))).toBe("escape");
    expect(shortcutFor(press("?", { shiftKey: true }))).toBe("toggleHelp");
  });

  test("undo and redo with Ctrl or Cmd", () => {
    expect(shortcutFor(press("z", { ctrlKey: true }))).toBe("undo");
    expect(shortcutFor(press("z", { metaKey: true }))).toBe("undo");
    expect(shortcutFor(press("Z", { metaKey: true, shiftKey: true }))).toBe(
      "redo",
    );
    expect(shortcutFor(press("y", { ctrlKey: true }))).toBe("redo");
  });

  test("zoom and select all", () => {
    expect(shortcutFor(press("+", { shiftKey: true }))).toBe("zoomIn");
    expect(shortcutFor(press("="))).toBe("zoomIn");
    expect(shortcutFor(press("-"))).toBe("zoomOut");
    expect(shortcutFor(press("0"))).toBe("zoomReset");
    expect(shortcutFor(press("a", { metaKey: true }))).toBe("selectAll");
    expect(shortcutFor(press("a", { ctrlKey: true }))).toBe("selectAll");
    expect(shortcutFor(press("a"))).toBeNull();
  });

  test("other combinations do nothing", () => {
    expect(shortcutFor(press("n", { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(press("c", { metaKey: true }))).toBeNull();
    expect(shortcutFor(press("f", { shiftKey: true }))).toBeNull();
    expect(shortcutFor(press("z", { altKey: true, ctrlKey: true }))).toBeNull();
    expect(shortcutFor(press("/"))).toBeNull();
    expect(shortcutFor(press("x"))).toBeNull();
  });
});

describe("nudgeFor", () => {
  test("arrows move one step, with or without Shift", () => {
    expect(nudgeFor(press("ArrowLeft"))).toEqual({ dx: -1, dy: 0 });
    expect(nudgeFor(press("ArrowDown", { shiftKey: true }))).toEqual({
      dx: 0,
      dy: 1,
    });
  });

  test("with Ctrl, Cmd or Alt, or any other key, nothing", () => {
    expect(nudgeFor(press("ArrowUp", { metaKey: true }))).toBeNull();
    expect(nudgeFor(press("ArrowUp", { altKey: true }))).toBeNull();
    expect(nudgeFor(press("x"))).toBeNull();
  });
});

describe("shortcutList", () => {
  test("lists every shortcut, with the command key of the system", () => {
    const list = shortcutList("⌘");
    expect(list).toHaveLength(15);
    expect(list.find((item) => item.what === "Deshacer")!.keys).toEqual([
      "⌘",
      "Z",
    ]);
  });
});
