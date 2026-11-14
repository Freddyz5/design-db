import {
  createDiagram,
  createId,
  type Diagram,
  type DiagramRepository,
  type DiagramSummary,
} from "@design-db/core";
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
  /** The saved diagrams, the most recent first, after saving what is waiting. */
  list: () => Promise<DiagramSummary[]>;
  /** Opens the saved diagram with that id. */
  openSaved: (id: string) => Promise<void>;
  /** Starts an empty diagram, saved at once so it shows in the list. */
  create: () => Promise<void>;
  /** Opens a saved copy of the diagram open, named «… (copia)». */
  duplicate: () => Promise<void>;
  /** Deletes the diagram open and opens the most recent one left, or an empty one. */
  removeCurrent: () => Promise<void>;
};

/** The name of a new diagram. */
export const UNTITLED = "Sin título";

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
      const { updatedAt } = await repository.save(diagram);
      lastOpened?.set(diagram.id);
      setView({ savedAt: updatedAt });
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
    const summary = stored
      ? (await repository.list()).find((item) => item.id === diagram.id)
      : undefined;
    setView({ savedAt: summary?.updatedAt ?? null });
  };

  /** Opens a diagram that is not stored yet and stores it. */
  const openNew = async (diagram: Diagram) => {
    await open(diagram, false);
    const { updatedAt } = await repository.save(diagram);
    autosave.reset(diagram, true);
    lastOpened?.set(diagram.id);
    setView({ savedAt: updatedAt });
  };

  const current = () => selectDiagram(store.getState());

  const blank = () =>
    createDiagram({ name: UNTITLED, dialect: current().dialect });

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
    async list() {
      await autosave.flush();
      return repository.list();
    },
    async openSaved(id) {
      if (id === current().id) return;
      await autosave.flush();
      const diagram = await repository.load(id);
      if (diagram) await open(diagram, true);
    },
    create: () => openNew(blank()),
    duplicate: () => {
      const source = current();
      return openNew({
        ...source,
        id: createId(),
        name: `${source.name} (copia)`,
      });
    },
    async removeCurrent() {
      // Whatever is on its way to be saved goes first, so it can't bring the diagram back.
      await autosave.flush();
      const { id } = current();
      autosave.reset(current(), true);
      await repository.remove(id);
      const [recent] = await repository.list();
      const next = recent ? await repository.load(recent.id) : null;
      if (next) await open(next, true);
      else await openNew(blank());
    },
  };
}
