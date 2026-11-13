import {
  apply,
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
  /** The table open in the edit panel, if any. */
  editingTableId: Id | null;
  /** The selected relation, if any. */
  selectedRelationId: Id | null;
  /** A short message about the last change, shown with a way to undo it. Gone on the next change. */
  notice: string | null;
};

export type EditorState = {
  /** The diagram with its undo and redo steps. Change it only through the actions below. */
  history: History<Diagram>;
  view: EditorView;

  /**
   * Applies one operation as one undo step. Throws `OperationError` if it
   * points at something missing. Changes in a row with the same `mergeKey`
   * are one step: typing a name is undone whole, not letter by letter.
   */
  dispatch: (op: Op, options?: { mergeKey?: string }) => void;
  /** Makes `next` the diagram as one undo step: several operations at once, an import, a code edit. */
  replace: (next: Diagram) => void;
  /** Says what the last change was, so it can be undone from the message. Call it after the change. */
  notify: (notice: string) => void;
  /** Closes the current step, so the next change starts a new one even with the same `mergeKey`: a field lost focus. */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  /** Starts over with another diagram and an empty history. */
  load: (diagram: Diagram) => void;
  setView: (patch: Partial<EditorView>) => void;
};

export type EditorStore = StoreApi<EditorState>;

const EMPTY_VIEW: EditorView = {
  selection: [],
  editingTableId: null,
  selectedRelationId: null,
  notice: null,
};

/**
 * The view after the diagram changed: without what no longer exists (a
 * selected table that was undone) and without the notice about the change before.
 */
function viewFor(view: EditorView, diagram: Diagram): EditorView {
  const exists = (id: Id) => diagram.tables.some((table) => table.id === id);
  const selection = view.selection.filter(exists);
  const editingTableId =
    view.editingTableId !== null && exists(view.editingTableId)
      ? view.editingTableId
      : null;
  const selectedRelationId =
    view.selectedRelationId !== null &&
    diagram.relations.some((r) => r.id === view.selectedRelationId)
      ? view.selectedRelationId
      : null;
  if (
    selection.length === view.selection.length &&
    editingTableId === view.editingTableId &&
    selectedRelationId === view.selectedRelationId &&
    view.notice === null
  ) {
    return view;
  }
  return {
    ...view,
    selection,
    editingTableId,
    selectedRelationId,
    notice: null,
  };
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
      dispatch: (op, options) =>
        move((history) =>
          options?.mergeKey === undefined
            ? pushOp(history, op)
            : push(history, apply(history.present, op), options),
        ),
      replace: (next) => move((history) => push(history, next)),
      checkpoint: () => move(checkpoint),
      undo: () => move(undo),
      redo: () => move(redo),
      load: (next) => set({ history: createHistory(next), view: EMPTY_VIEW }),
      notify: (notice) => set((state) => ({ view: { ...state.view, notice } })),
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
