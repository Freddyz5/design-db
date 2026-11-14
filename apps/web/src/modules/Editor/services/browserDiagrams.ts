import type { DiagramRepository } from "@design-db/core";
import {
  createSqliteDiagramRepository,
  type SqlRunner,
} from "./SqliteDiagramRepository";
import type { SqlReply, SqlRequest } from "./sqliteMessages";

/** The diagrams saved in this browser. */
export type BrowserDiagrams = {
  repository: DiagramRepository;
  /** Whether what is saved survives closing the page. False when the browser has no OPFS. */
  persistent: Promise<boolean>;
};

let opened: BrowserDiagrams | null = null;

/** Starts the SQLite worker the first time and returns the repository on it. */
export function openBrowserDiagrams(): BrowserDiagrams {
  if (opened) return opened;

  const worker = new Worker(new URL("./sqliteWorker.ts", import.meta.url), {
    type: "module",
  });
  const pending = new Map<
    number,
    { resolve: (rows: unknown) => void; reject: (error: Error) => void }
  >();
  let nextId = 1;
  let markReady: (persistent: boolean) => void = () => {};
  const persistent = new Promise<boolean>((resolve) => {
    markReady = resolve;
  });

  worker.addEventListener("message", (event: MessageEvent<SqlReply>) => {
    const message = event.data;
    if (message.type === "ready") {
      markReady(message.persistent);
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    if (message.error !== undefined) request.reject(new Error(message.error));
    else request.resolve(message.rows);
  });

  const run: SqlRunner = (sql, params, method) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, {
        resolve: (rows) => resolve({ rows: rows as unknown[] }),
        reject,
      });
      worker.postMessage({ id, sql, params, method } satisfies SqlRequest);
    });

  opened = { repository: createSqliteDiagramRepository(run), persistent };
  return opened;
}
