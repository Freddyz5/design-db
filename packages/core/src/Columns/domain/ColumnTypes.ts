import type { Dialect } from "../../shared";

const TYPES: Record<Dialect, readonly string[]> = {
  generic: [
    "integer",
    "bigint",
    "smallint",
    "decimal(10,2)",
    "real",
    "boolean",
    "varchar(255)",
    "text",
    "char(10)",
    "date",
    "time",
    "timestamp",
    "uuid",
    "json",
  ],
  postgres: [
    "serial",
    "bigserial",
    "integer",
    "bigint",
    "smallint",
    "numeric(10,2)",
    "real",
    "double precision",
    "boolean",
    "varchar(255)",
    "text",
    "char(10)",
    "date",
    "time",
    "timestamp",
    "timestamptz",
    "interval",
    "uuid",
    "json",
    "jsonb",
    "bytea",
  ],
  mysql: [
    "int",
    "bigint",
    "smallint",
    "tinyint",
    "decimal(10,2)",
    "float",
    "double",
    "boolean",
    "varchar(255)",
    "text",
    "char(10)",
    "date",
    "time",
    "datetime",
    "timestamp",
    "json",
    "blob",
  ],
  sqlite: ["integer", "real", "text", "blob", "numeric"],
};

/** Common column types for a dialect, for the editor's type picker. */
export function suggestedColumnTypes(dialect: Dialect): string[] {
  return [...TYPES[dialect]];
}

/** Types that store the same value under another name. */
const SAME_TYPE: Readonly<Record<string, string>> = {
  int: "integer",
  // An auto-numbered key and the foreign key that points at it.
  serial: "integer",
  bigserial: "bigint",
  smallserial: "smallint",
};

/** The type as stored: without case or extra spaces, and with the names above merged. */
function storedType(type: string): string {
  const text = type.trim().toLowerCase().replace(/\s+/g, " ");
  return SAME_TYPE[text] ?? text;
}

/**
 * Whether two column types store the same value, such as `int` and
 * `integer`, or a `serial` key and the `integer` that points at it.
 */
export function isSameColumnType(a: string, b: string): boolean {
  return storedType(a) === storedType(b);
}
