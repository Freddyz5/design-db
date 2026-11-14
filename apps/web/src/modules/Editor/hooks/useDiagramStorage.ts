import { useEffect, useState } from "react";
import { openBrowserDiagrams } from "../services/browserDiagrams";
import { browserLastOpened } from "../services/lastOpened";
import { createDiagramStorage, type DiagramStorage } from "./DiagramStorage";
import { editorStore } from "./useEditorStore";

let storage: DiagramStorage | null = null;

/** The storage of the editor on this page, on the browser's SQLite. Started on first use. */
export function getDiagramStorage(): DiagramStorage {
  if (!storage) {
    const { repository, persistent } = openBrowserDiagrams();
    storage = createDiagramStorage(editorStore, repository, {
      persistent,
      lastOpened: browserLastOpened,
    });
  }
  return storage;
}

/**
 * Opens the last diagram and keeps the diagram saved while the editor is
 * mounted. Returns false until the last diagram is open, so the example does
 * not show first and then jump.
 */
export function useDiagramStorage(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const current = getDiagramStorage();
    const stop = current.start();
    current
      .restore()
      .catch(() => editorStore.getState().setView({ saveStatus: "error" }))
      .finally(() => setReady(true));
    return stop;
  }, []);
  return ready;
}
