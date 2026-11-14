// SQLite in a Web Worker. The database file lives in the browser's private
// storage (OPFS) through the "opfs-sahpool" VFS, which needs no special headers.
import sqlite3InitModule, { type Database } from "@sqlite.org/sqlite-wasm";
import type { SqlReply, SqlRequest } from "./sqliteMessages";

const DATABASE_FILE = "/design-db.sqlite3";

async function openDatabase(): Promise<{ db: Database; persistent: boolean }> {
  const sqlite3 = await sqlite3InitModule();
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: "design-db" });
    return { db: new pool.OpfsSAHPoolDb(DATABASE_FILE), persistent: true };
  } catch {
    // Without OPFS (a private window in some browsers) the editor still works, but nothing lasts.
    return { db: new sqlite3.oo1.DB(":memory:", "c"), persistent: false };
  }
}

const opening = openDatabase();
const reply = (message: SqlReply) => postMessage(message);

opening.then(
  ({ persistent }) => reply({ type: "ready", persistent }),
  (error: unknown) =>
    reply({ type: "ready", persistent: false, error: String(error) }),
);

addEventListener("message", async (event: MessageEvent<SqlRequest>) => {
  const { id, sql, params, method } = event.data;
  try {
    const { db } = await opening;
    const rows = db.exec({
      sql,
      bind: params.length > 0 ? (params as never) : undefined,
      rowMode: "array",
      returnValue: "resultRows",
    });
    reply({ type: "result", id, rows: method === "get" ? rows[0] : rows });
  } catch (error) {
    reply({ type: "result", id, error: String(error) });
  }
});
