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

describe("merging steps", () => {
  const rename = (name: string) =>
    ({ type: "table.update", tableId: "users", patch: { name } }) as const;
  const key = { mergeKey: "table.name:users" };

  test("changes with the same merge key are one undo step", () => {
    const { state, present, initial } = setup();
    for (const name of ["p", "pe", "people"])
      state().dispatch(rename(name), key);
    expect(present().tables[0]!.name).toBe("people");

    state().undo();
    expect(present()).toBe(initial);
  });

  test("a checkpoint closes the step", () => {
    const { state, present } = setup();
    state().dispatch(rename("people"), key);
    state().checkpoint();
    state().dispatch(rename("persons"), key);

    state().undo();
    expect(present().tables[0]!.name).toBe("people");
  });

  test("a change without a key in between closes the step too", () => {
    const { state, present } = setup();
    state().dispatch(rename("people"), key);
    state().dispatch({ type: "table.remove", tableId: "posts" });
    state().dispatch(rename("persons"), key);

    state().undo();
    expect(present().tables[0]!.name).toBe("people");
    expect(present().tables).toHaveLength(1);
  });

  test("moving the same table twice in a row is one step, as in the core", () => {
    const { state, present, initial } = setup();
    const moveTo = (x: number) =>
      ({
        type: "table.move",
        tableId: "users",
        position: { x, y: 0 },
      }) as const;
    state().dispatch(moveTo(10));
    state().dispatch(moveTo(20));
    state().undo();
    expect(present()).toBe(initial);
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
  test("starts over with an empty history and nothing selected, keeping the filters", () => {
    const { state, present } = setup();
    state().setView({ selection: ["users"], columnsFilter: "keys" });
    state().dispatch({ type: "table.remove", tableId: "posts" });

    const other = createDiagram({ name: "Empty" });
    state().load(other);
    expect(present()).toBe(other);
    expect(selectCanUndo(state())).toBe(false);
    expect(state().view.selection).toEqual([]);
    expect(state().view.columnsFilter).toBe("keys");
  });
});

describe("view", () => {
  test("the filters start showing everything and are not undo steps", () => {
    const { state } = setup();
    expect(state().view.columnsFilter).toBe("all");
    expect(state().view.relationsFilter).toBe("all");
    state().setView({ relationsFilter: "focus" });
    expect(selectCanUndo(state())).toBe(false);
  });

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

  test("the edit panel closes when its table no longer exists", () => {
    const { state } = setup();
    state().dispatch({ type: "table.add", table: table("tags") });
    state().setView({ editingTableId: "tags" });
    state().dispatch({ type: "table.remove", tableId: "posts" });
    expect(state().view.editingTableId).toBe("tags");

    state().undo();
    state().undo();
    expect(state().view.editingTableId).toBeNull();
  });

  test("a relation that no longer exists is no longer selected", () => {
    const { state } = setup();
    state().dispatch({
      type: "relation.add",
      relation: {
        id: "posts-users",
        from: { tableId: "posts", columnIds: ["posts.id"] },
        to: { tableId: "users", columnIds: ["users.id"] },
        onDelete: "no action",
        onUpdate: "no action",
      },
    });
    state().setView({ selectedRelationId: "posts-users" });
    state().undo();
    expect(state().view.selectedRelationId).toBeNull();
  });

  test("a notice lasts until the next change", () => {
    const { state } = setup();
    state().dispatch({ type: "table.remove", tableId: "posts" });
    state().notify("posts eliminada");
    expect(state().view.notice).toBe("posts eliminada");

    state().setView({ selection: ["users"] });
    expect(state().view.notice).toBe("posts eliminada");

    state().undo();
    expect(state().view.notice).toBeNull();
    expect(state().view.selection).toEqual(["users"]);
  });

  test("does not notify when undo has nothing to do", () => {
    const { store, state } = setup();
    let calls = 0;
    store.subscribe(() => calls++);
    state().undo();
    state().redo();
    state().checkpoint();
    expect(calls).toBe(0);
  });
});
