import type { Column } from "../../Columns";
import type { Diagram } from "../../Diagrams";
import type { Enum } from "../../Enums";
import type { Group } from "../../Groups";
import { getCardinality, type Relation } from "../../Relations";
import type { Dialect } from "../../shared";
import type { Table } from "../../Tables";

const DATABASE_TYPE: Partial<Record<Dialect, string>> = {
  postgres: "PostgreSQL",
  mysql: "MySQL",
  sqlite: "SQLite",
};

/**
 * Generates the DBML of a diagram: Project (with the dialect), Enum, Table,
 * Ref and TableGroup. Relations that point at missing tables or columns
 * are skipped.
 */
export function toDbml(diagram: Diagram): string {
  const blocks = [
    ...project(diagram),
    ...diagram.enums.map(enumBlock),
    ...diagram.tables.map((t) => tableBlock(diagram, t)),
    ...refs(diagram),
    ...diagram.groups.map((g) => groupBlock(diagram, g)),
  ];
  return blocks.length ? blocks.join("\n\n") + "\n" : "";
}

function project(diagram: Diagram): string[] {
  const type = DATABASE_TYPE[diagram.dialect];
  if (!type) return [];
  return [`Project ${name(diagram.name)} {\n  database_type: '${type}'\n}`];
}

function enumBlock(item: Enum): string {
  const lines = item.values.map((v) => `  ${name(v)}`);
  if (item.note) lines.push("", `  Note: ${text(item.note)}`);
  return `Enum ${name(item.name)} {\n${lines.join("\n")}\n}`;
}

function tableBlock(diagram: Diagram, table: Table): string {
  const primaryKey = table.columns.filter((c) => c.primaryKey);
  const inlineKey = primaryKey.length === 1;
  const lines = table.columns.map(
    (c) =>
      `  ${name(c.name)} ${type(c.type)}${settings(columnSettings(c, inlineKey))}`,
  );
  if (primaryKey.length > 1) {
    lines.push(
      "",
      "  indexes {",
      `    (${primaryKey.map((c) => name(c.name)).join(", ")}) [pk]`,
      "  }",
    );
  }
  if (table.comment) lines.push("", `  Note: ${text(table.comment)}`);

  const color = diagram.layout.tables[table.id]?.color;
  const tableSettings = isHexColor(color) ? [`headercolor: ${color}`] : [];
  return `Table ${name(table.name)}${settings(tableSettings)} {\n${lines.join("\n")}\n}`;
}

function columnSettings(column: Column, inlineKey: boolean): string[] {
  const result: string[] = [];
  if (column.primaryKey && inlineKey) result.push("pk");
  if (column.autoIncrement) result.push("increment");
  if (column.unique && !(column.primaryKey && inlineKey)) result.push("unique");
  if (!column.nullable && !(column.primaryKey && inlineKey)) {
    result.push("not null");
  }
  if (column.default !== undefined && column.default.trim() !== "") {
    result.push(`default: ${defaultValue(column.default.trim())}`);
  }
  if (column.comment) result.push(`note: ${text(column.comment)}`);
  return result;
}

function refs(diagram: Diagram): string[] {
  return diagram.relations.flatMap((relation) => {
    const ends = resolve(diagram, relation);
    if (!ends) return [];
    const one = getCardinality(diagram, relation)?.kind === "1:1";
    const actions = [
      ...(relation.onDelete === "no action"
        ? []
        : [`delete: ${relation.onDelete}`]),
      ...(relation.onUpdate === "no action"
        ? []
        : [`update: ${relation.onUpdate}`]),
    ];
    const label = relation.name ? ` ${name(relation.name)}` : "";
    return [
      `Ref${label}: ${ends.from} ${one ? "-" : ">"} ${ends.to}${settings(actions)}`,
    ];
  });
}

function groupBlock(diagram: Diagram, group: Group): string {
  const lines = diagram.tables
    .filter((t) => t.groupId === group.id)
    .map((t) => `  ${name(t.name)}`);
  if (group.note) lines.push("", `  Note: ${text(group.note)}`);
  const groupSettings = isHexColor(group.color)
    ? [`color: ${group.color}`]
    : [];
  return `TableGroup ${name(group.name)}${settings(groupSettings)} {\n${lines.join("\n")}\n}`;
}

/** `table.column` or `table.(a, b)` for each end, if both exist. */
function resolve(
  diagram: Diagram,
  relation: Relation,
): { from: string; to: string } | undefined {
  const endText = (tableId: string, columnIds: string[]) => {
    const table = diagram.tables.find((t) => t.id === tableId);
    if (!table) return undefined;
    const columns = columnIds.map((id) =>
      table.columns.find((c) => c.id === id),
    );
    if (columns.some((c) => !c)) return undefined;
    const names = columns.map((c) => name(c!.name));
    const list = names.length === 1 ? names[0] : `(${names.join(", ")})`;
    return `${name(table.name)}.${list}`;
  };
  const from = endText(relation.from.tableId, relation.from.columnIds);
  const to = endText(relation.to.tableId, relation.to.columnIds);
  return from && to ? { from, to } : undefined;
}

function settings(items: string[]): string {
  return items.length ? ` [${items.join(", ")}]` : "";
}

/** Names stay bare when they are simple identifiers. */
function name(value: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
    ? value
    : `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

/** Types like `varchar(255)` stay bare; `double precision` gets quotes. */
function type(value: string): string {
  const trimmed = value.trim() || "text";
  return /^[A-Za-z_][A-Za-z0-9_]*(\([0-9, ]*\))?(\[\])?$/.test(trimmed)
    ? trimmed
    : name(trimmed);
}

/** A DBML string; multi-line text uses triple quotes. */
function text(value: string): string {
  if (value.includes("\n")) return `'''${value.replaceAll("'''", "\\'''")}'''`;
  return `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
}

/**
 * Converts a SQL default into DBML: numbers, booleans and null stay bare,
 * SQL strings become DBML strings and anything else is an expression.
 */
function defaultValue(value: string): string {
  if (/^-?\d+(\.\d+)?$/.test(value)) return value;
  if (/^(true|false|null)$/i.test(value)) return value.toLowerCase();
  const sqlString = /^'((?:[^']|'')*)'$/.exec(value);
  if (sqlString) return text(sqlString[1]!.replaceAll("''", "'"));
  return `\`${value}\``;
}

function isHexColor(value: string | undefined): value is string {
  return value !== undefined && /^#[0-9a-f]{3,8}$/i.test(value);
}
