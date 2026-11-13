import {
  importSchema,
  mergeDiagram,
  unplacedTableIds,
  type Diagram,
  type Id,
  type ImportIssue,
} from "@design-db/core";
import type { CodeFormat } from "./codeFormats";

/** What reading the code of the panel gave. */
export type CodeResult =
  | {
      ok: true;
      /** The diagram with the code applied, or the same diagram when the code changed nothing. */
      diagram: Diagram;
      warnings: ImportIssue[];
      /** New tables, which still need a position. */
      unplaced: Id[];
    }
  | { ok: false; errors: ImportIssue[] };

/** A JSON text of a value with its keys sorted, so two equal values give the same text. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : item,
  );
}

/** Whether two diagrams have the same schema and the same positions. */
export function sameSchema(a: Diagram, b: Diagram): boolean {
  const pick = (diagram: Diagram) => ({
    tables: diagram.tables,
    relations: diagram.relations,
    groups: diagram.groups,
    enums: diagram.enums,
    layout: diagram.layout.tables,
  });
  return stableJson(pick(a)) === stableJson(pick(b));
}

/**
 * Reads the code typed in the panel and applies it to the diagram with
 * `mergeDiagram(…, "replace")`: tables, columns and groups that already
 * existed keep their id, position and color. While the code has errors the
 * diagram is left alone.
 */
export function applyCode(
  current: Diagram,
  text: string,
  format: CodeFormat,
): CodeResult {
  const read = importSchema(text, format);
  if (!read.ok) return { ok: false, errors: read.errors };

  const merged = mergeDiagram(current, read.diagram, "replace");
  const diagram = sameSchema(merged, current) ? current : merged;
  return {
    ok: true,
    diagram,
    warnings: read.warnings,
    unplaced: unplacedTableIds(diagram),
  };
}
