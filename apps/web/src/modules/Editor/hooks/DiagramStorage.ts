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
  /**
   * Opens the diagram the user was last on, or the most recent one. With
   * nothing saved, the editor keeps what it has (the example).
   */
  restore: () => Promise<void>;
};

/** Remembers which diagram was open last, for the next visit. */
export type LastOpened = {
  get: () => string | null;
  set: (id: string) => void;
};

export function createDiagramStorage(
  store: EditorStore,
  repository: DiagramRepository,
  options: {
    persistent?: Promise<boolean>;
    schedule?: Schedule;
    lastOpened?: LastOpened;
  } = {},
): DiagramStorage {
  const setView = store.getState().setView;
  const lastOpened = options.lastOpened;
  const autosave = createAutosave<Diagram>({
    save: async (diagram) => {
      await repository.save(diagram);
      lastOpened?.set(diagram.id);
    },
    onStatus: (saveStatus) => setView({ saveStatus }),
    schedule: options.schedule,
  });
  // What the editor starts with (the example) is not saved until it changes.
  autosave.reset(selectDiagram(store.getState()), false);

  const open = async (diagram: Diagram, stored: boolean) => {
    await autosave.flush();
    store.getState().load(diagram);
    autosave.reset(diagram, stored);
    if (stored) lastOpened?.set(diagram.id);
  };

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
    open,
    async restore() {
      const lastId = lastOpened?.get() ?? null;
      let diagram = lastId === null ? null : await repository.load(lastId);
      if (!diagram) {
        const [recent] = await repository.list();
        if (recent) diagram = await repository.load(recent.id);
      }
      if (diagram) await open(diagram, true);
    },
  };
}
