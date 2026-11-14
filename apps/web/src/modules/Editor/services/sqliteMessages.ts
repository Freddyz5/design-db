/** What the page asks the SQLite worker: one statement. */
export type SqlRequest = {
  id: number;
  sql: string;
  params: unknown[];
  method: "run" | "all" | "values" | "get";
};

/** What the worker answers: once when the database is open, then one result per request. */
export type SqlReply =
  | { type: "ready"; persistent: boolean; error?: string }
  | { type: "result"; id: number; rows?: unknown; error?: string };
