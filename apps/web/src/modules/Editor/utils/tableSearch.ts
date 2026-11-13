import { searchTables, type Diagram, type SearchResult } from "@design-db/core";

/** One result of the table search, ready to show. */
export type SearchItem = {
  tableId: string;
  name: string;
  /** Why it matched, when it was not by the table name: the matching columns. */
  hint: string;
};

/** The tables that match the query, best first, as the search list shows them. */
export function searchItems(diagram: Diagram, query: string): SearchItem[] {
  return searchTables(diagram, query, 12).map((result: SearchResult) => {
    const columns = result.table.columns
      .filter((column) => result.columnIds.includes(column.id))
      .map((column) => column.name);
    return {
      tableId: result.table.id,
      name: result.table.name,
      hint:
        result.match === "column"
          ? `${columns.length === 1 ? "columna" : "columnas"} ${columns.join(", ")}`
          : "",
    };
  });
}

/** The option after moving `step` from `current` in a list of `length`, wrapping around. -1 means none. */
export function moveActive(
  current: number,
  step: number,
  length: number,
): number {
  if (length === 0) return -1;
  if (current === -1) return step > 0 ? 0 : length - 1;
  return (current + step + length) % length;
}
