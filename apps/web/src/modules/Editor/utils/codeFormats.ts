import {
  toDbml,
  toDrizzle,
  toSql,
  type Dialect,
  type Diagram,
} from "@design-db/core";

/** The ways the code panel can write the diagram. */
export const CODE_FORMATS = ["sql", "dbml", "drizzle"] as const;
export type CodeFormat = (typeof CODE_FORMATS)[number];

/** The dialects the editor offers, with the name the interface shows. */
export const DIALECT_NAMES: Record<Dialect, string> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
  generic: "SQL estándar",
};

/** The dialects to choose from. `generic` is offered only when the diagram already uses it. */
export function dialectChoices(current: Dialect): Dialect[] {
  const choices: Dialect[] = ["postgres", "mysql", "sqlite"];
  return current === "generic" ? [...choices, "generic"] : choices;
}

/** The name of each format, as its tab shows it. */
export const FORMAT_NAMES: Record<CodeFormat, string> = {
  sql: "SQL",
  dbml: "DBML",
  drizzle: "Drizzle",
};

/** The full name of a format: SQL says which dialect it is written for. */
export function formatLabel(format: CodeFormat, dialect: Dialect): string {
  return format === "sql"
    ? `SQL · ${DIALECT_NAMES[dialect]}`
    : FORMAT_NAMES[format];
}

/** The diagram written in a format. */
export function generateCode(diagram: Diagram, format: CodeFormat): string {
  if (format === "sql") return toSql(diagram);
  return format === "dbml" ? toDbml(diagram) : toDrizzle(diagram);
}

const EXTENSION: Record<CodeFormat, string> = {
  sql: "sql",
  dbml: "dbml",
  drizzle: "ts",
};

/** A file name for the code: the name of the diagram in lowercase with dashes, and the extension of the format. */
export function codeFileName(diagram: Diagram, format: CodeFormat): string {
  const slug = diagram.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = slug || "diagrama";
  return `${format === "drizzle" ? "schema" : base}.${EXTENSION[format]}`;
}

/** The width of the code panel when the editor opens. */
export const CODE_WIDTH = 440;
const CODE_MIN_WIDTH = 300;
/** What the canvas keeps at least, whatever the width of the code. */
const CANVAS_MIN_WIDTH = 360;

/** A width for the code panel that leaves room for the canvas in a window that wide. */
export function clampCodeWidth(width: number, windowWidth: number): number {
  const most = Math.max(CODE_MIN_WIDTH, windowWidth - CANVAS_MIN_WIDTH);
  return Math.round(Math.min(most, Math.max(CODE_MIN_WIDTH, width)));
}
