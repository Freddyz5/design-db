import {
  createDiagram,
  importSchema,
  mergeDiagram,
  unplacedTableIds,
  type Diagram,
  type Id,
  type ImportIssue,
  type MergeMode,
  type SchemaFormat,
} from "@design-db/core";

/** The name of each format the import understands, as the interface says it. */
export const SCHEMA_FORMAT_NAMES: Record<SchemaFormat, string> = {
  sql: "SQL",
  dbml: "DBML",
  drizzle: "Drizzle",
  json: "JSON",
};

/** The name a diagram gets when nobody names it. */
const DEFAULT_NAME = createDiagram().name;

/** What importing a text would bring, shown before importing. */
export type ImportPreview =
  | {
      ok: true;
      format: SchemaFormat;
      tables: number;
      relations: number;
      groups: number;
      /** How many of its tables already exist in the diagram (same name, ignoring case). */
      existing: number;
      warnings: ImportIssue[];
    }
  | { ok: false; format: SchemaFormat; errors: ImportIssue[] };

/** Reads a text as it would be imported, without changing anything. A text with no tables is an error. */
export function previewImport(current: Diagram, text: string): ImportPreview {
  const read = importSchema(text);
  if (!read.ok) return { ok: false, format: read.format, errors: read.errors };
  const { diagram } = read;
  if (diagram.tables.length === 0) {
    return {
      ok: false,
      format: read.format,
      errors: [{ message: "No hay tablas en el texto.", line: 0 }],
    };
  }
  const names = new Set(current.tables.map((t) => t.name.toLowerCase()));
  return {
    ok: true,
    format: read.format,
    tables: diagram.tables.length,
    relations: diagram.relations.length,
    groups: diagram.groups.length,
    existing: diagram.tables.filter((t) => names.has(t.name.toLowerCase()))
      .length,
    warnings: read.warnings,
  };
}

/** The diagram after an import, still without positions for the tables that need one. */
export type ImportOutcome = {
  diagram: Diagram;
  /** Tables that still need a position. */
  unplaced: Id[];
  /** The tables the import brought, after merging. */
  imported: Id[];
  notice: string;
};

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Imports a text into the diagram, adding to it or replacing it, with
 * `mergeDiagram`. An empty diagram also takes the name and the dialect of
 * what was imported. Returns null when the text cannot be imported.
 */
export function runImport(
  current: Diagram,
  text: string,
  mode: MergeMode,
): ImportOutcome | null {
  const read = importSchema(text);
  if (!read.ok || read.diagram.tables.length === 0) return null;
  const incoming = read.diagram;

  let diagram = mergeDiagram(current, incoming, mode);
  if (current.tables.length === 0) {
    diagram = {
      ...diagram,
      ...(incoming.name !== DEFAULT_NAME ? { name: incoming.name } : {}),
      ...(incoming.dialect !== "generic" ? { dialect: incoming.dialect } : {}),
    };
  }

  const before = new Set(current.tables.map((t) => t.id));
  const names = new Set(incoming.tables.map((t) => t.name.toLowerCase()));
  const imported =
    mode === "replace"
      ? diagram.tables.map((t) => t.id)
      : diagram.tables.filter((t) => !before.has(t.id)).map((t) => t.id);
  const updated =
    mode === "replace"
      ? current.tables.filter((t) => names.has(t.name.toLowerCase())).length
      : 0;

  const from = SCHEMA_FORMAT_NAMES[read.format];
  const notice =
    mode === "replace"
      ? `Importaste ${count(incoming.tables.length, "tabla", "tablas")} desde ${from}${updated ? `; ${count(updated, "ya existía", "ya existían")}` : ""}.`
      : `Agregaste ${count(imported.length, "tabla", "tablas")} desde ${from}.`;

  return { diagram, unplaced: unplacedTableIds(diagram), imported, notice };
}
