import type { Dialect } from "../../shared";

// What the Drizzle export and import share: modules, column builders by
// dialect and how names become variables.

/** Drizzle has no generic dialect; generic diagrams use PostgreSQL. */
export type DrizzleDialect = "postgres" | "mysql" | "sqlite";

export function drizzleDialect(dialect: Dialect): DrizzleDialect {
  return dialect === "generic" ? "postgres" : dialect;
}

export const DRIZZLE_MODULE: Record<DrizzleDialect, string> = {
  postgres: "drizzle-orm/pg-core",
  mysql: "drizzle-orm/mysql-core",
  sqlite: "drizzle-orm/sqlite-core",
};

export const TABLE_FUNCTION: Record<DrizzleDialect, string> = {
  postgres: "pgTable",
  mysql: "mysqlTable",
  sqlite: "sqliteTable",
};

/** The type used to annotate references to a table declared later. */
export const ANY_COLUMN: Record<DrizzleDialect, string> = {
  postgres: "AnyPgColumn",
  mysql: "AnyMySqlColumn",
  sqlite: "AnySQLiteColumn",
};

// --- Column types ---------------------------------------------------------

export type OptionValue = string | number | boolean;

/** A column builder call such as `varchar({ length: 255 })`. */
export type BuilderCall = {
  builder: string;
  options: [string, OptionValue][];
  /** PostgreSQL arrays: `text().array()`. */
  array: boolean;
};

type Spec = {
  builder: string;
  /** Options every column of this type gets. */
  options?: [string, OptionValue][];
  /** Names of the numbers in parentheses, e.g. `numeric(10,2)`. */
  args?: string[];
  /** Options used when the type has no numbers in parentheses. */
  fallback?: [string, OptionValue][];
};

/** Builds a table from `[spec, ...type names]` entries. */
function specs(...entries: [Spec, ...string[]][]): Record<string, Spec> {
  const table: Record<string, Spec> = {};
  for (const [spec, ...names] of entries) {
    for (const name of names) table[name] = spec;
  }
  return table;
}

const LENGTH = ["length"];
const PRECISION = ["precision"];
const PRECISION_SCALE = ["precision", "scale"];
const FSP = ["fsp"];
const NUMBER_MODE: [string, OptionValue][] = [["mode", "number"]];

/**
 * The SQL types each dialect has a builder for. The first name of each
 * entry is the one the import gives back; the others are aliases.
 */
const SPECS: Record<DrizzleDialect, Record<string, Spec>> = {
  postgres: specs(
    [{ builder: "integer" }, "integer", "int", "int4"],
    [{ builder: "smallint" }, "smallint", "int2"],
    [{ builder: "bigint", options: NUMBER_MODE }, "bigint", "int8"],
    [{ builder: "serial" }, "serial", "serial4"],
    [{ builder: "smallserial" }, "smallserial", "serial2"],
    [{ builder: "bigserial", options: NUMBER_MODE }, "bigserial", "serial8"],
    [{ builder: "boolean" }, "boolean", "bool"],
    [{ builder: "text" }, "text"],
    [{ builder: "varchar", args: LENGTH }, "varchar", "character varying"],
    [{ builder: "char", args: LENGTH }, "char", "character"],
    [{ builder: "numeric", args: PRECISION_SCALE }, "numeric", "decimal"],
    [{ builder: "real" }, "real", "float4"],
    [{ builder: "doublePrecision" }, "double precision", "float8"],
    [{ builder: "json" }, "json"],
    [{ builder: "jsonb" }, "jsonb"],
    [{ builder: "uuid" }, "uuid"],
    [{ builder: "date" }, "date"],
    [{ builder: "interval" }, "interval"],
    [{ builder: "inet" }, "inet"],
    [{ builder: "cidr" }, "cidr"],
    [{ builder: "macaddr" }, "macaddr"],
    [
      { builder: "timestamp", args: PRECISION },
      "timestamp",
      "timestamp without time zone",
    ],
    [
      {
        builder: "timestamp",
        options: [["withTimezone", true]],
        args: PRECISION,
      },
      "timestamptz",
      "timestamp with time zone",
    ],
    [{ builder: "time", args: PRECISION }, "time", "time without time zone"],
    [
      { builder: "time", options: [["withTimezone", true]], args: PRECISION },
      "timetz",
      "time with time zone",
    ],
  ),
  mysql: specs(
    [{ builder: "int" }, "int", "integer"],
    [{ builder: "tinyint" }, "tinyint"],
    [{ builder: "smallint" }, "smallint"],
    [{ builder: "mediumint" }, "mediumint"],
    [{ builder: "bigint", options: NUMBER_MODE }, "bigint"],
    [{ builder: "serial" }, "serial"],
    [{ builder: "boolean" }, "boolean", "bool"],
    [{ builder: "text" }, "text"],
    [{ builder: "tinytext" }, "tinytext"],
    [{ builder: "mediumtext" }, "mediumtext"],
    [{ builder: "longtext" }, "longtext"],
    [
      { builder: "varchar", args: LENGTH, fallback: [["length", 255]] },
      "varchar",
      "character varying",
    ],
    [{ builder: "char", args: LENGTH }, "char"],
    [{ builder: "decimal", args: PRECISION_SCALE }, "decimal", "numeric"],
    [{ builder: "float" }, "float"],
    [{ builder: "double" }, "double", "double precision"],
    [{ builder: "real" }, "real"],
    [{ builder: "json" }, "json"],
    [{ builder: "timestamp", args: FSP }, "timestamp"],
    [{ builder: "datetime", args: FSP }, "datetime"],
    [{ builder: "date" }, "date"],
    [{ builder: "time", args: FSP }, "time"],
    [{ builder: "year" }, "year"],
    [{ builder: "binary", args: LENGTH }, "binary"],
    [{ builder: "varbinary", args: LENGTH }, "varbinary"],
  ),
  sqlite: specs(
    [{ builder: "integer" }, "integer", "int"],
    [{ builder: "integer", options: [["mode", "boolean"]] }, "boolean", "bool"],
    [{ builder: "integer", options: [["mode", "timestamp"]] }, "timestamp"],
    [{ builder: "text" }, "text"],
    [{ builder: "text", args: LENGTH }, "varchar"],
    [{ builder: "text", options: [["mode", "json"]] }, "json"],
    [{ builder: "real" }, "real"],
    [{ builder: "numeric" }, "numeric"],
    [{ builder: "blob" }, "blob"],
  ),
};

/** Every builder name of a dialect, so variables never hide one. */
export function builderNames(dialect: DrizzleDialect): string[] {
  return [...new Set(Object.values(SPECS[dialect]).map((s) => s.builder))];
}

/**
 * The Drizzle builder for a SQL type, or `undefined` when the dialect has
 * none (the export then declares a `customType`).
 */
export function toBuilder(
  type: string,
  dialect: DrizzleDialect,
): BuilderCall | undefined {
  const parsed = parseType(type);
  if (!parsed) return undefined;
  if (parsed.array && dialect !== "postgres") return undefined;
  const spec = SPECS[dialect][parsed.base];
  if (!spec) return undefined;
  const argNames = spec.args ?? [];
  if (parsed.args.length > argNames.length) return undefined;
  const options: [string, OptionValue][] = [...(spec.options ?? [])];
  parsed.args.forEach((value, i) => options.push([argNames[i]!, value]));
  if (!parsed.args.length && spec.fallback) options.push(...spec.fallback);
  return { builder: spec.builder, options, array: parsed.array };
}

type ParsedType = { base: string; args: number[]; array: boolean };

/** `numeric(10, 2)` → base `numeric`, args `[10, 2]`. */
function parseType(type: string): ParsedType | undefined {
  let text = type.trim().toLowerCase().replace(/\s+/g, " ");
  let array = false;
  if (text.endsWith("[]")) {
    array = true;
    text = text.slice(0, -2).trim();
  }
  const args: number[] = [];
  const match = /^([^()]*)\(([^()]*)\)([^()]*)$/.exec(text);
  if (match) {
    const parts = match[2]!.split(",").map((p) => p.trim());
    if (!parts.every((p) => /^\d+$/.test(p))) return undefined;
    args.push(...parts.map(Number));
    text = `${match[1]!.trim()} ${match[3]!.trim()}`.trim();
  } else if (/[()]/.test(text)) {
    return undefined;
  }
  return { base: text, args, array };
}

// --- Names ----------------------------------------------------------------

/** `posts_tags` → `postsTags`, `Post Tags` → `postTags`, `ID` → `id`. */
export function toIdentifier(name: string): string {
  const parts = name.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const [first, ...rest] = parts;
  if (first === undefined) return "_";
  const head =
    first === first.toUpperCase()
      ? first.toLowerCase()
      : first[0]!.toLowerCase() + first.slice(1);
  const id = head + rest.map((p) => p[0]!.toUpperCase() + p.slice(1)).join("");
  return /^\p{N}/u.test(id) ? `_${id}` : id;
}

/** `postStatus` → `post_status`. Other shapes are kept as they are. */
export function fromIdentifier(id: string): string {
  if (!/^[a-z][a-zA-Z0-9]*$/.test(id)) return id;
  return id.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Words a variable cannot be named. */
export const JS_RESERVED = new Set(
  (
    "await break case catch class const continue debugger default delete do " +
    "else enum export extends false finally for function if implements " +
    "import in instanceof interface let new null package private protected " +
    "public return static super switch this throw true try typeof var void " +
    "while with yield"
  ).split(" "),
);
