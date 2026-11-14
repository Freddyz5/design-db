import { useEffect } from "react";
import { openBrowserDiagrams } from "../services/browserDiagrams";
import { createDiagramStorage, type DiagramStorage } from "./DiagramStorage";
import { editorStore } from "./useEditorStore";

let storage: DiagramStorage | null = null;

/** The storage of the editor on this page, on the browser's SQLite. Started on first use. */
export function getDiagramStorage(): DiagramStorage {
  if (!storage) {
    const { repository, persistent } = openBrowserDiagrams();
    storage = createDiagramStorage(editorStore, repository, { persistent });
  }
  return storage;
}

/** Keeps the diagram saved while the editor is mounted. */
export function useDiagramStorage(): void {
  useEffect(() => getDiagramStorage().start(), []);
}
