import {
  canRedo,
  canUndo,
  checkpoint,
  createExampleDiagram,
  createHistory,
  push,
  pushOp,
  redo,
  undo,
  type Diagram,
  type History,
  type Id,
  type Op,
} from "@design-db/core";
import { createStore, type StoreApi } from "zustand/vanilla";

/** What the user is looking at. It is not part of the diagram, so it never enters the history. */
export type EditorView = {
  /** Ids of the selected tables. */
  selection: Id[];
};

export type EditorState = {
  /** The diagram with its undo and redo steps. Change it only through the actions below. */
  history: History<Diagram>;
  view: EditorView;

  /** Applies one operation as one undo step. Throws `OperationError` if it points at something missing. */
  dispatch: (op: Op) => void;
  /** Makes `next` the diagram as one undo step: several operations at once, an import, a code edit. */
  replace: (next: Diagram) => void;
  /** Call when a drag starts, so the whole drag is one step and does not join the previous one. */
  beginDrag: () => void;
  undo: () => void;
  redo: () => void;
  /** Starts over with another diagram and an empty history. */
  load: (diagram: Diagram) => void;
  setView: (patch: Partial<EditorView>) => void;
};

export type EditorStore = StoreApi<EditorState>;

const EMPTY_VIEW: EditorView = { selection: [] };

/** Drops from the view what no longer exists in the diagram, such as a selected table that was undone. */
function viewFor(view: EditorView, diagram: Diagram): EditorView {
  const selection = view.selection.filter((id) =>
    diagram.tables.some((table) => table.id === id),
  );
  return selection.length === view.selection.length
    ? view
    : { ...view, selection };
}

/** Creates the editor's store. It starts with the example diagram unless one is given. */
export function createEditorStore(
  diagram: Diagram = createExampleDiagram(),
): EditorStore {
  return createStore<EditorState>()((set) => {
    /** Sets the history and keeps the view pointing at things that exist. */
    const move = (change: (history: History<Diagram>) => History<Diagram>) =>
      set((state) => {
        const history = change(state.history);
        if (history === state.history) return state;
        return { history, view: viewFor(state.view, history.present) };
      });

    return {
      history: createHistory(diagram),
      view: EMPTY_VIEW,
      dispatch: (op) => move((history) => pushOp(history, op)),
      replace: (next) => move((history) => push(history, next)),
      beginDrag: () => move(checkpoint),
      undo: () => move(undo),
      redo: () => move(redo),
      load: (next) => set({ history: createHistory(next), view: EMPTY_VIEW }),
      setView: (patch) =>
        set((state) => ({ view: { ...state.view, ...patch } })),
    };
  });
}

export const selectDiagram = (state: EditorState): Diagram =>
  state.history.present;
export const selectCanUndo = (state: EditorState): boolean =>
  canUndo(state.history);
export const selectCanRedo = (state: EditorState): boolean =>
  canRedo(state.history);
