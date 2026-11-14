import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { createDiagram, createExampleDiagram } from "@design-db/core";
import {
  createSqliteDiagramRepository,
  type SqlRunner,
} from "./SqliteDiagramRepository";

/** The same SQL the Worker runs, on bun:sqlite in memory. */
function memoryRunner(): SqlRunner {
  const db = new Database(":memory:");
  return async (sql, params, method) => {
    const statement = db.query(sql);
    if (method === "run") {
      statement.run(...params);
      return { rows: [] };
    }
    const rows = statement.values(...params);
    // For "get", Drizzle wants the row itself, or nothing when there is none.
    return { rows: method === "get" ? (rows[0] as unknown[]) : rows };
  };
}

describe("SqliteDiagramRepository", () => {
  test("saves a diagram and loads it back whole", async () => {
    const repository = createSqliteDiagramRepository(memoryRunner());
    const diagram = createExampleDiagram();
    await repository.save(diagram);
    expect(await repository.load(diagram.id)).toEqual(diagram);
  });

  test("loading a diagram that is not there gives null", async () => {
    const repository = createSqliteDiagramRepository(memoryRunner());
    expect(await repository.load("missing")).toBeNull();
  });

  test("saving again replaces the diagram with the same id", async () => {
    const repository = createSqliteDiagramRepository(memoryRunner());
    const diagram = createDiagram({ name: "Uno" });
    await repository.save(diagram, "2026-11-14T10:00:00.000Z");
    await repository.save(
      { ...diagram, name: "Dos" },
      "2026-11-14T11:00:00.000Z",
    );
    expect(await repository.list()).toEqual([
      {
        id: diagram.id,
        name: "Dos",
        tableCount: 0,
        updatedAt: "2026-11-14T11:00:00.000Z",
      },
    ]);
  });

  test("lists the most recently edited first, with its table count", async () => {
    const repository = createSqliteDiagramRepository(memoryRunner());
    const old = createDiagram({ name: "Viejo" });
    const example = createExampleDiagram();
    await repository.save(old, "2026-11-01T00:00:00.000Z");
    await repository.save(example, "2026-11-14T00:00:00.000Z");
    const list = await repository.list();
    expect(list.map((item) => item.name)).toEqual([example.name, "Viejo"]);
    expect(list[0]?.tableCount).toBe(example.tables.length);
  });

  test("removes a diagram", async () => {
    const repository = createSqliteDiagramRepository(memoryRunner());
    const diagram = createDiagram();
    await repository.save(diagram);
    await repository.remove(diagram.id);
    await repository.remove(diagram.id);
    expect(await repository.list()).toEqual([]);
    expect(await repository.load(diagram.id)).toBeNull();
  });
});
