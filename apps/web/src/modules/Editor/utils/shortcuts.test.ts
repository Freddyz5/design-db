import { describe, expect, test } from "bun:test";
import { shortcutFor, shortcutList, type KeyPress } from "./shortcuts";

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

  test("other combinations do nothing", () => {
    expect(shortcutFor(press("n", { ctrlKey: true }))).toBeNull();
    expect(shortcutFor(press("c", { metaKey: true }))).toBeNull();
    expect(shortcutFor(press("f", { shiftKey: true }))).toBeNull();
    expect(shortcutFor(press("z", { altKey: true, ctrlKey: true }))).toBeNull();
    expect(shortcutFor(press("/"))).toBeNull();
    expect(shortcutFor(press("x"))).toBeNull();
  });
});

describe("shortcutList", () => {
  test("lists every shortcut, with the command key of the system", () => {
    const list = shortcutList("⌘");
    expect(list).toHaveLength(10);
    expect(list.find((item) => item.what === "Deshacer")!.keys).toEqual([
      "⌘",
      "Z",
    ]);
  });
});
