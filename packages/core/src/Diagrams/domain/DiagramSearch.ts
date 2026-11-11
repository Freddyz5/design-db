import type { Id } from "../../shared";
import type { Table } from "../../Tables";
import type { Diagram } from "./Diagram";

export type SearchMatch = "prefix" | "name" | "column";

export type SearchResult = {
  table: Table;
  /** How it matched: the name starts with the query, contains it, or a column does. */
  match: SearchMatch;
  /** Columns whose name contains the query, to highlight them. */
  columnIds: Id[];
};

const RANK: Record<SearchMatch, number> = { prefix: 0, name: 1, column: 2 };

/**
 * Finds tables by name and by column name, ignoring case and accents.
 * Names that start with the query come first, then names that contain it,
 * then tables with a matching column; ties are sorted by name.
 */
export function searchTables(
  diagram: Diagram,
  query: string,
  limit = 20,
): SearchResult[] {
  const q = normalize(query);
  if (!q) return [];

  const results: SearchResult[] = [];
  for (const table of diagram.tables) {
    const name = normalize(table.name);
    const columnIds = table.columns
      .filter((c) => normalize(c.name).includes(q))
      .map((c) => c.id);
    const match: SearchMatch | undefined = name.startsWith(q)
      ? "prefix"
      : name.includes(q)
        ? "name"
        : columnIds.length
          ? "column"
          : undefined;
    if (match) results.push({ table, match, columnIds });
  }

  return results
    .sort(
      (a, b) =>
        RANK[a.match] - RANK[b.match] ||
        a.table.name.length - b.table.name.length ||
        a.table.name.localeCompare(b.table.name),
    )
    .slice(0, limit);
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}
