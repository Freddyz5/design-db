import { COLUMNS_FILTERS, RELATIONS_FILTERS } from "../constants/filters";
import type { ColumnsFilter, RelationsFilter } from "./canvasElements";

/**
 * What the canvas leaves out, as the «Vista» button says it: the label of
 * each filter that is not the default one («Claves», «Enfoque»…), or an
 * empty string when everything is shown.
 */
export function viewSummary(
  columns: ColumnsFilter,
  relations: RelationsFilter,
): string {
  const parts: string[] = [];
  if (columns !== "all") {
    parts.push(COLUMNS_FILTERS.find((f) => f.value === columns)?.label ?? "");
  }
  if (relations !== "all") {
    parts.push(
      RELATIONS_FILTERS.find((f) => f.value === relations)?.label ?? "",
    );
  }
  return parts.filter(Boolean).join(", ");
}
