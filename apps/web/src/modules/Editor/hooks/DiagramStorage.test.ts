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
  const stamp = () => new Date(Date.UTC(2026, 10, 14, 0, 0, clock++)).toISOString();
  for (const diagram of initial) rows.set(diagram.id, { diagram, updatedAt: stamp() });
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

function setup(initial: Diagram[] = []) {
  const store = createEditorStore();
  const { repository, saves } = memoryRepository(initial);
  const storage = createDiagramStorage(store, repository, { schedule: never });
  const stop = storage.start();
  return { store, repository, saves, storage, stop };
}

describe("DiagramStorage", () => {
  test("the example is not saved until it changes", async () => {
    const { store, saves, storage } = setup();
    await storage.flush();
    expect(saves).toEqual([]);
    expect(store.getState().view.saveStatus).toBe("idle");

    store.getState().dispatch({ type: "diagram.update", patch: { name: "Tienda" } });
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
    store.getState().dispatch({ type: "diagram.update", patch: { name: "Primero" } });
    await storage.open(createDiagram({ name: "Segundo" }), true);
    expect(saves.map((d) => d.name)).toEqual(["Primero"]);
  });

  test("after stopping, changes are no longer saved", async () => {
    const { store, saves, storage, stop } = setup();
    stop();
    store.getState().dispatch({ type: "diagram.update", patch: { name: "Nada" } });
    await storage.flush();
    expect(saves).toEqual([]);
  });
});
