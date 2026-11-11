import { describe, expect, test } from "bun:test";
import { createTable } from "./factories";
import {
  canRedo,
  canUndo,
  checkpoint,
  createHistory,
  push,
  pushOp,
  redo,
  undo,
} from "./history";
import { blogDiagram } from "./test-utils";

describe("history", () => {
  test("starts with nothing to undo or redo", () => {
    const history = createHistory("a");
    expect(history.present).toBe("a");
    expect(canUndo(history)).toBe(false);
    expect(canRedo(history)).toBe(false);
  });

  test("undo and redo walk through the states", () => {
    let history = createHistory("a");
    history = push(history, "b");
    history = push(history, "c");

    history = undo(history);
    expect(history.present).toBe("b");
    history = undo(history);
    expect(history.present).toBe("a");
    expect(canUndo(history)).toBe(false);

    history = redo(history);
    expect(history.present).toBe("b");
    history = redo(history);
    expect(history.present).toBe("c");
    expect(canRedo(history)).toBe(false);
  });

  test("undo and redo do nothing at the ends", () => {
    const history = createHistory("a");
    expect(undo(history)).toBe(history);
    expect(redo(history)).toBe(history);
  });

  test("a new change clears the redo stack", () => {
    let history = push(push(createHistory("a"), "b"), "c");
    history = undo(history);
    history = push(history, "d");
    expect(history.present).toBe("d");
    expect(canRedo(history)).toBe(false);
    expect(undo(history).present).toBe("b");
  });

  test("pushing the same state does not add a step", () => {
    const history = createHistory("a");
    expect(push(history, "a")).toBe(history);
  });

  test("keeps at most `limit` steps", () => {
    let history = createHistory(0, { limit: 3 });
    for (let i = 1; i <= 5; i++) history = push(history, i);
    expect(history.past).toEqual([2, 3, 4]);
    expect(history.present).toBe(5);
  });

  test("the default limit is 100", () => {
    let history = createHistory(0);
    for (let i = 1; i <= 150; i++) history = push(history, i);
    expect(history.past).toHaveLength(100);
  });

  test("pushes with the same merge key count as one step", () => {
    let history = createHistory("a");
    history = push(history, "b", { mergeKey: "x" });
    history = push(history, "c", { mergeKey: "x" });
    history = push(history, "d", { mergeKey: "x" });
    expect(history.past).toEqual(["a"]);
    expect(undo(history).present).toBe("a");
  });

  test("a different key, no key, undo or a checkpoint stop the merge", () => {
    let history = push(createHistory("a"), "b", { mergeKey: "x" });
    expect(push(history, "c", { mergeKey: "y" }).past).toEqual(["a", "b"]);
    expect(push(history, "c").past).toEqual(["a", "b"]);
    expect(push(checkpoint(history), "c", { mergeKey: "x" }).past).toEqual([
      "a",
      "b",
    ]);

    history = push(history, "c", { mergeKey: "x" });
    history = undo(history);
    expect(push(history, "d", { mergeKey: "x" }).past).toEqual(["a"]);
  });
});

describe("pushOp", () => {
  test("applies the operation and records it", () => {
    const start = blogDiagram();
    let history = createHistory(start);
    history = pushOp(history, {
      type: "table.add",
      table: createTable({ id: "tags", name: "tags" }),
    });
    expect(history.present.tables).toHaveLength(3);
    expect(undo(history).present).toBe(start);
  });

  test("moving the same table several times is one step", () => {
    const start = blogDiagram();
    let history = createHistory(start);
    for (let x = 1; x <= 10; x++) {
      history = pushOp(history, {
        type: "table.move",
        tableId: "users",
        position: { x, y: 0 },
      });
    }
    expect(history.present.layout.tables.users).toEqual({ x: 10, y: 0 });
    expect(history.past).toHaveLength(1);
    expect(undo(history).present).toBe(start);
  });

  test("moving another table is a new step", () => {
    let history = createHistory(blogDiagram());
    history = pushOp(history, {
      type: "table.move",
      tableId: "users",
      position: { x: 1, y: 1 },
    });
    history = pushOp(history, {
      type: "table.move",
      tableId: "posts",
      position: { x: 2, y: 2 },
    });
    expect(history.past).toHaveLength(2);
  });
});
