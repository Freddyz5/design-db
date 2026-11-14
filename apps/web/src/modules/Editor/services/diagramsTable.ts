import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** One row per diagram: the whole diagram as JSON, plus what the list shows. */
export const diagrams = sqliteTable("diagrams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  tableCount: integer("table_count").notNull(),
  updatedAt: text("updated_at").notNull(),
  data: text("data").notNull(),
});

/** Creates the table if the database is new. Kept by hand: there is a single table. */
export const CREATE_DIAGRAMS = sql`CREATE TABLE IF NOT EXISTS diagrams (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  table_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL
)`;
