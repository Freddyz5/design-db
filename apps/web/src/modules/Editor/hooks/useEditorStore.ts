import { useStore } from "zustand";
import { createEditorStore, type EditorState } from "./EditorStore";

/** The store of the editor on this page. There is one editor per page. */
export const editorStore = createEditorStore();

/** Reads a slice of the editor's state and re-renders when it changes. */
export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  return useStore(editorStore, selector);
}
