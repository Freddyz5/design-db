import {
  parseDiagram,
  summarizeDiagram,
  type DiagramRepository,
  type DiagramSummary,
} from "@design-db/core";
import { desc, eq } from "drizzle-orm";
import { drizzle, type AsyncRemoteCallback } from "drizzle-orm/sqlite-proxy";
import { CREATE_DIAGRAMS, diagrams } from "./diagramsTable";

/**
 * Runs one SQL statement somewhere (a Web Worker, bun:sqlite in tests) and
 * returns its rows as arrays. For `get`, `rows` is the one row itself, or
 * undefined when there is none.
 */
export type SqlRunner = AsyncRemoteCallback;

/** The diagrams repository on SQLite, through Drizzle. It creates its table on first use. */
export function createSqliteDiagramRepository(
  run: SqlRunner,
): DiagramRepository {
  const db = drizzle(run);
  const ready = db.run(CREATE_DIAGRAMS);

  return {
    async list() {
      await ready;
      const rows = await db
        .select({
          id: diagrams.id,
          name: diagrams.name,
          tableCount: diagrams.tableCount,
          updatedAt: diagrams.updatedAt,
        })
        .from(diagrams)
        .orderBy(desc(diagrams.updatedAt));
      return rows satisfies DiagramSummary[];
    },

    async load(id) {
      await ready;
      const row = await db
        .select({ data: diagrams.data })
        .from(diagrams)
        .where(eq(diagrams.id, id))
        .get();
      if (!row) return null;
      const parsed = parseDiagram(JSON.parse(row.data));
      if (!parsed.ok) throw new Error(`Saved diagram ${id} is invalid: ${parsed.error}`);
      return parsed.diagram;
    },

    async save(diagram, updatedAt = new Date().toISOString()) {
      await ready;
      const summary = summarizeDiagram(diagram, updatedAt);
      const row = { ...summary, data: JSON.stringify(diagram) };
      await db
        .insert(diagrams)
        .values(row)
        .onConflictDoUpdate({ target: diagrams.id, set: row });
      return summary;
    },

    async remove(id) {
      await ready;
      await db.delete(diagrams).where(eq(diagrams.id, id));
    },
  };
}
