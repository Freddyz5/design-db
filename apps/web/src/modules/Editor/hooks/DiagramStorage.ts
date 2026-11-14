import type { Diagram, DiagramRepository } from "@design-db/core";
import { createAutosave, type Schedule } from "../utils/autosave";
import { selectDiagram, type EditorStore } from "./EditorStore";

/** Keeps the diagram in the editor saved in the repository. */
export type DiagramStorage = {
  /** Starts saving every change. Returns how to stop. */
  start: () => () => void;
  /** Saves now what is waiting. */
  flush: () => Promise<void>;
  /**
   * Opens `diagram` in the editor after saving the one open. `stored` says it
   * is already in the repository, so it is not saved again until it changes.
   */
  open: (diagram: Diagram, stored: boolean) => Promise<void>;
};

export function createDiagramStorage(
  store: EditorStore,
  repository: DiagramRepository,
  options: { persistent?: Promise<boolean>; schedule?: Schedule } = {},
): DiagramStorage {
  const setView = store.getState().setView;
  const autosave = createAutosave<Diagram>({
    save: (diagram) => repository.save(diagram),
    onStatus: (saveStatus) => setView({ saveStatus }),
    schedule: options.schedule,
  });
  // What the editor starts with (the example) is not saved until it changes.
  autosave.reset(selectDiagram(store.getState()), false);

  return {
    start() {
      void options.persistent?.then((persistent) => setView({ persistent }));
      const unsubscribe = store.subscribe((state, previous) => {
        const diagram = selectDiagram(state);
        if (diagram !== selectDiagram(previous)) autosave.changed(diagram);
      });
      // Leaving the tab (or closing it) saves at once instead of waiting.
      const onHide = () => {
        if (document.visibilityState === "hidden") void autosave.flush();
      };
      const page = typeof document === "undefined" ? null : document;
      page?.addEventListener("visibilitychange", onHide);
      return () => {
        unsubscribe();
        page?.removeEventListener("visibilitychange", onHide);
        autosave.dispose();
      };
    },
    flush: autosave.flush,
    async open(diagram, stored) {
      await autosave.flush();
      store.getState().load(diagram);
      autosave.reset(diagram, stored);
    },
  };
}
