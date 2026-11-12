import { describe, expect, test } from "bun:test";
import {
  OperationError,
  createColumn,
  createDiagram,
  createTable,
  type Diagram,
} from "@design-db/core";
import {
  createEditorStore,
  selectCanRedo,
  selectCanUndo,
  selectDiagram,
} from "./EditorStore";

const table = (id: string) =>
  createTable({
    id,
    name: id,
    columns: [createColumn({ id: `${id}.id`, name: "id", primaryKey: true })],
  });

/** A store with the tables `users` and `posts`, and no undo steps. */
function setup() {
  let diagram: Diagram = createDiagram({ name: "Shop" });
  for (const id of ["users", "posts"]) {
    diagram = { ...diagram, tables: [...diagram.tables, table(id)] };
  }
  const store = createEditorStore(diagram);
  const state = () => store.getState();
  const present = () => selectDiagram(state());
  return { store, state, present, initial: diagram };
}

describe("createEditorStore", () => {
  test("starts with the example diagram and nothing to undo", () => {
    const state = createEditorStore().getState();
    expect(selectDiagram(state).tables.length).toBeGreaterThan(0);
    expect(selectCanUndo(state)).toBe(false);
    expect(selectCanRedo(state)).toBe(false);
    expect(state.view.selection).toEqual([]);
  });
});

describe("dispatch", () => {
  test("applies the operation as one undo step", () => {
    const { state, present, initial } = setup();
    state().dispatch({ type: "table.add", table: table("tags") });
    expect(present().tables.map((t) => t.name)).toEqual([
      "users",
      "posts",
      "tags",
    ]);
    expect(selectCanUndo(state())).toBe(true);

    state().undo();
    expect(present()).toBe(initial);
    expect(selectCanRedo(state())).toBe(true);

    state().redo();
    expect(present().tables).toHaveLength(3);
  });

  test("clears the redo steps", () => {
    const { state } = setup();
    state().dispatch({ type: "table.remove", tableId: "posts" });
    state().undo();
    state().dispatch({ type: "table.remove", tableId: "users" });
    expect(selectCanRedo(state())).toBe(false);
  });

  test("throws and leaves the diagram as it was when the operation is not valid", () => {
    const { state, present, initial } = setup();
    expect(() =>
      state().dispatch({ type: "table.remove", tableId: "nope" }),
    ).toThrow(OperationError);
    expect(present()).toBe(initial);
    expect(selectCanUndo(state())).toBe(false);
  });
});

describe("dragging", () => {
  const moveTo = (x: number) =>
    ({ type: "table.move", tableId: "users", position: { x, y: 0 } }) as const;

  test("a whole drag is one undo step", () => {
    const { state, present, initial } = setup();
    state().beginDrag();
    for (const x of [10, 20, 30]) state().dispatch(moveTo(x));
    expect(present().layout.tables["users"]).toEqual({ x: 30, y: 0 });

    state().undo();
    expect(present()).toBe(initial);
  });

  test("two drags of the same table are two steps", () => {
    const { state, present } = setup();
    state().beginDrag();
    state().dispatch(moveTo(10));
    state().dispatch(moveTo(20));
    state().beginDrag();
    state().dispatch(moveTo(30));
    state().dispatch(moveTo(40));

    state().undo();
    expect(present().layout.tables["users"]).toEqual({ x: 20, y: 0 });
    state().undo();
    expect(present().layout.tables["users"]).toBeUndefined();
  });
});

describe("replace", () => {
  test("makes another diagram the present as one step", () => {
    const { state, present, initial } = setup();
    const next = { ...initial, name: "Blog", tables: [] };
    state().replace(next);
    expect(present()).toBe(next);

    state().undo();
    expect(present()).toBe(initial);
  });

  test("does nothing when the diagram is the same", () => {
    const { state, initial } = setup();
    state().replace(initial);
    expect(selectCanUndo(state())).toBe(false);
  });
});

describe("load", () => {
  test("starts over with an empty history and an empty view", () => {
    const { state, present } = setup();
    state().setView({ selection: ["users"] });
    state().dispatch({ type: "table.remove", tableId: "posts" });

    const other = createDiagram({ name: "Empty" });
    state().load(other);
    expect(present()).toBe(other);
    expect(selectCanUndo(state())).toBe(false);
    expect(state().view.selection).toEqual([]);
  });
});

describe("view", () => {
  test("changing the view adds no undo step", () => {
    const { state, initial, present } = setup();
    state().setView({ selection: ["users", "posts"] });
    expect(state().view.selection).toEqual(["users", "posts"]);
    expect(selectCanUndo(state())).toBe(false);
    expect(present()).toBe(initial);
  });

  test("undo and redo keep the selection", () => {
    const { state } = setup();
    state().setView({ selection: ["users"] });
    state().dispatch({
      type: "table.move",
      tableId: "users",
      position: { x: 5, y: 5 },
    });
    state().undo();
    expect(state().view.selection).toEqual(["users"]);
  });

  test("a table that no longer exists leaves the selection", () => {
    const { state } = setup();
    state().dispatch({ type: "table.add", table: table("tags") });
    state().setView({ selection: ["users", "tags"] });

    state().undo();
    expect(state().view.selection).toEqual(["users"]);

    state().setView({ selection: ["users", "posts"] });
    state().dispatch({ type: "table.remove", tableId: "posts" });
    expect(state().view.selection).toEqual(["users"]);
  });

  test("does not notify when undo has nothing to do", () => {
    const { store, state } = setup();
    let calls = 0;
    store.subscribe(() => calls++);
    state().undo();
    state().redo();
    state().beginDrag();
    expect(calls).toBe(0);
  });
});
