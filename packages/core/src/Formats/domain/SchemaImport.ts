import { createDiagram, parseDiagram, type Diagram } from "../../Diagrams";
import { readDbml } from "./DbmlImport";
import { buildDiagram, type ImportIssue } from "./SchemaDraft";
import { readSql } from "./SqlImport";

export type SchemaFormat = "sql" | "dbml" | "json";

export type ImportResult =
  | {
      ok: true;
      format: SchemaFormat;
      diagram: Diagram;
      warnings: ImportIssue[];
    }
  | { ok: false; format: SchemaFormat; errors: ImportIssue[] };

/** Guesses the format of a schema from its text. */
export function detectFormat(text: string): SchemaFormat {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{")) return "json";
  if (
    /^\s*(Table|TableGroup|Enum|Project)\s+[^\n]*\{/im.test(text) ||
    /^\s*Ref\b[^\n]*[:{]/im.test(text)
  ) {
    return "dbml";
  }
  return "sql";
}

/**
 * Reads a schema in SQL (PostgreSQL or MySQL), DBML or the project's JSON
 * and turns it into a diagram. SQL and DBML tables come without a
 * position, so the editor can lay them out. An empty text gives an empty
 * diagram.
 */
export function importSchema(
  text: string,
  format: SchemaFormat = detectFormat(text),
): ImportResult {
  if (!text.trim()) {
    return { ok: true, format, diagram: createDiagram(), warnings: [] };
  }
  if (format === "json") return importJson(text);

  const read = format === "sql" ? readSql(text) : readDbml(text);
  if (!read.draft || read.errors.length) {
    return { ok: false, format, errors: read.errors };
  }
  const { diagram, warnings } = buildDiagram(read.draft);
  return {
    ok: true,
    format,
    diagram,
    warnings: [...read.warnings, ...warnings],
  };
}

function importJson(text: string): ImportResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      format: "json",
      errors: [{ message, line: jsonErrorLine(text, message) }],
    };
  }
  const parsed = parseDiagram(value);
  if (!parsed.ok) {
    return {
      ok: false,
      format: "json",
      errors: [{ message: parsed.error, line: 1 }],
    };
  }
  return { ok: true, format: "json", diagram: parsed.diagram, warnings: [] };
}

/** JSON.parse reports a position or a line; turn it into a line. */
function jsonErrorLine(text: string, message: string): number {
  const line = /line (\d+)/i.exec(message);
  if (line) return Number(line[1]);
  const position = /position (\d+)/i.exec(message);
  if (position) return text.slice(0, Number(position[1])).split("\n").length;
  return 1;
}
