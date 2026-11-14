import { describe, expect, test } from "bun:test";
import {
  createDiagram,
  summarizeDiagram,
  type Diagram,
  type DiagramRepository,
} from "@design-db/core";
import type { Schedule } from "../utils/autosave";
import { createDiagramStorage } from "./DiagramStorage";
import { createEditorStore, selectDiagram } from "./EditorStore";

/** A repository in memory, recording what it saved. */
export function memoryRepository(initial: Diagram[] = []) {
  const rows = new Map<string, { diagram: Diagram; updatedAt: string }>();
  let clock = 0;
  const stamp = () =>
    new Date(Date.UTC(2026, 10, 14, 0, 0, clock++)).toISOString();
  for (const diagram of initial)
    rows.set(diagram.id, { diagram, updatedAt: stamp() });
  const saves: Diagram[] = [];
  const repository: DiagramRepository = {
    async list() {
      return [...rows.values()]
        .map(({ diagram, updatedAt }) => summarizeDiagram(diagram, updatedAt))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },
    async load(id) {
      return rows.get(id)?.diagram ?? null;
    },
    async save(diagram, updatedAt = stamp()) {
      rows.set(diagram.id, { diagram, updatedAt });
      saves.push(diagram);
      return summarizeDiagram(diagram, updatedAt);
    },
    async remove(id) {
      rows.delete(id);
    },
  };
  return { repository, saves };
}

/** Runs scheduled saves only when the test asks. */
const never: Schedule = () => () => {};

function setup(initial: Diagram[] = [], last: string | null = null) {
  const store = createEditorStore();
  const { repository, saves } = memoryRepository(initial);
  const lastOpened = {
    id: last,
    get: () => lastOpened.id,
    set: (id: string) => {
      lastOpened.id = id;
    },
  };
  const storage = createDiagramStorage(store, repository, {
    schedule: never,
    lastOpened,
  });
  const stop = storage.start();
  return { store, repository, saves, storage, stop, lastOpened };
}

describe("DiagramStorage", () => {
  test("the example is not saved until it changes", async () => {
    const { store, saves, storage } = setup();
    await storage.flush();
    expect(saves).toEqual([]);
    expect(store.getState().view.saveStatus).toBe("idle");

    store
      .getState()
      .dispatch({ type: "diagram.update", patch: { name: "Tienda" } });
    expect(store.getState().view.saveStatus).toBe("pending");
    await storage.flush();
    expect(saves.map((d) => d.name)).toEqual(["Tienda"]);
    expect(store.getState().view.saveStatus).toBe("saved");
  });

  test("opening a stored diagram does not save it again", async () => {
    const stored = createDiagram({ name: "Guardado" });
    const { store, saves, storage } = setup([stored]);
    await storage.open(stored, true);
    await storage.flush();
    expect(selectDiagram(store.getState())).toBe(stored);
    expect(saves).toEqual([]);
    expect(store.getState().view.saveStatus).toBe("saved");
  });

  test("opening another diagram first saves the changes waiting", async () => {
    const { store, saves, storage } = setup();
    store
      .getState()
      .dispatch({ type: "diagram.update", patch: { name: "Primero" } });
    await storage.open(createDiagram({ name: "Segundo" }), true);
    expect(saves.map((d) => d.name)).toEqual(["Primero"]);
  });

  test("after stopping, changes are no longer saved", async () => {
    const { store, saves, storage, stop } = setup();
    stop();
    store
      .getState()
      .dispatch({ type: "diagram.update", patch: { name: "Nada" } });
    await storage.flush();
    expect(saves).toEqual([]);
  });

  test("restores the diagram open last time", async () => {
    const first = createDiagram({ name: "Primero" });
    const second = createDiagram({ name: "Segundo" });
    const { store, storage } = setup([first, second], first.id);
    await storage.restore();
    expect(selectDiagram(store.getState()).name).toBe("Primero");
    expect(store.getState().view.saveStatus).toBe("saved");
  });

  test("without a last one, restores the most recent", async () => {
    const first = createDiagram({ name: "Primero" });
    const second = createDiagram({ name: "Segundo" });
    const { store, storage } = setup([first, second], "gone");
    await storage.restore();
    expect(selectDiagram(store.getState()).name).toBe("Segundo");
  });

  test("with nothing saved, keeps the example", async () => {
    const { store, storage } = setup();
    const example = selectDiagram(store.getState());
    await storage.restore();
    expect(selectDiagram(store.getState())).toBe(example);
  });

  test("a save remembers the diagram as the last one", async () => {
    const { store, storage, lastOpened } = setup();
    store
      .getState()
      .dispatch({ type: "diagram.update", patch: { name: "Mío" } });
    await storage.flush();
    expect(lastOpened.id).toBe(selectDiagram(store.getState()).id);
  });

  test("lists, opens another and comes back", async () => {
    const first = createDiagram({ name: "Primero" });
    const second = createDiagram({ name: "Segundo" });
    const { store, storage } = setup([first, second]);
    expect((await storage.list()).map((d) => d.name)).toEqual([
      "Segundo",
      "Primero",
    ]);
    await storage.openSaved(first.id);
    expect(selectDiagram(store.getState()).name).toBe("Primero");
    await storage.openSaved(second.id);
    expect(selectDiagram(store.getState()).name).toBe("Segundo");
  });

  test("a new diagram is empty and already in the list", async () => {
    const { store, storage } = setup();
    await storage.create();
    const diagram = selectDiagram(store.getState());
    expect(diagram.name).toBe("Sin título");
    expect(diagram.tables).toEqual([]);
    expect((await storage.list()).map((d) => d.id)).toEqual([diagram.id]);
  });

  test("duplicating opens a saved copy with a new id", async () => {
    const original = createDiagram({ name: "Tienda" });
    const { store, storage } = setup([original]);
    await storage.openSaved(original.id);
    await storage.duplicate();
    const copy = selectDiagram(store.getState());
    expect(copy.name).toBe("Tienda (copia)");
    expect(copy.id).not.toBe(original.id);
    expect((await storage.list()).length).toBe(2);
  });

  test("deleting opens the most recent left, or an empty one", async () => {
    const first = createDiagram({ name: "Primero" });
    const second = createDiagram({ name: "Segundo" });
    const { store, storage } = setup([first, second]);
    await storage.openSaved(second.id);
    await storage.removeCurrent();
    expect(selectDiagram(store.getState()).name).toBe("Primero");
    await storage.removeCurrent();
    expect(selectDiagram(store.getState()).name).toBe("Sin título");
    expect((await storage.list()).map((d) => d.name)).toEqual(["Sin título"]);
  });
});
