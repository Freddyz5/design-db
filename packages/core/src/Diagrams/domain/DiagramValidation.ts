import type { Column } from "../../Columns";
import type { Relation, RelationEnd } from "../../Relations";
import type { Id } from "../../shared";
import { isUniqueKey, type Table } from "../../Tables";
import type { Diagram } from "./Diagram";

export type Severity = "error" | "warning";

export type IssueCode =
  | "empty-table-name"
  | "duplicate-table-name"
  | "empty-column-name"
  | "duplicate-column-name"
  | "table-without-primary-key"
  | "nullable-primary-key"
  | "relation-missing-table"
  | "relation-missing-column"
  | "relation-column-count"
  | "relation-target-not-unique"
  | "relation-type-mismatch"
  | "empty-group-name"
  | "duplicate-group-name"
  | "table-missing-group"
  | "empty-enum-name"
  | "duplicate-enum-name"
  | "enum-without-values"
  | "duplicate-enum-value";

/**
 * A problem found in the diagram. `code` is stable so the editor can show
 * its own (translated) text; `message` is a readable default in English.
 */
export type Issue = {
  code: IssueCode;
  severity: Severity;
  message: string;
  tableId?: Id;
  columnId?: Id;
  relationId?: Id;
  groupId?: Id;
  enumId?: Id;
};

/**
 * Lists the problems in a diagram without blocking anything: while editing,
 * a diagram is often incomplete for a moment.
 */
export function validate(doc: Diagram): Issue[] {
  return [
    ...checkTableNames(doc.tables),
    ...doc.tables.flatMap(checkTable),
    ...doc.relations.flatMap((r) => checkRelation(doc, r)),
    ...checkGroups(doc),
    ...checkEnums(doc),
  ];
}

function checkEnums(doc: Diagram): Issue[] {
  const issues: Issue[] = [];
  for (const item of doc.enums) {
    const label = isBlank(item.name)
      ? "An unnamed enum"
      : `Enum "${item.name}"`;
    if (isBlank(item.name)) {
      issues.push({
        code: "empty-enum-name",
        severity: "error",
        message: "An enum has no name",
        enumId: item.id,
      });
    }
    if (item.values.length === 0) {
      issues.push({
        code: "enum-without-values",
        severity: "warning",
        message: `${label} has no values`,
        enumId: item.id,
      });
    }
    const seen = new Set<string>();
    const repeated = new Set<string>();
    for (const value of item.values) {
      if (seen.has(value)) repeated.add(value);
      seen.add(value);
    }
    for (const value of repeated) {
      issues.push({
        code: "duplicate-enum-value",
        severity: "error",
        message: `${label} has the value "${value}" more than once`,
        enumId: item.id,
      });
    }
  }
  for (const same of duplicates(doc.enums)) {
    for (const item of same) {
      issues.push({
        code: "duplicate-enum-name",
        severity: "error",
        message: `${same.length} enums are named "${item.name.trim()}"`,
        enumId: item.id,
      });
    }
  }
  return issues;
}

function checkGroups(doc: Diagram): Issue[] {
  const issues: Issue[] = [];
  for (const group of doc.groups) {
    if (isBlank(group.name)) {
      issues.push({
        code: "empty-group-name",
        severity: "error",
        message: "A group has no name",
        groupId: group.id,
      });
    }
  }
  for (const same of duplicates(doc.groups)) {
    for (const group of same) {
      issues.push({
        code: "duplicate-group-name",
        severity: "error",
        message: `${same.length} groups are named "${group.name.trim()}"`,
        groupId: group.id,
      });
    }
  }
  const groupIds = new Set(doc.groups.map((g) => g.id));
  for (const table of doc.tables) {
    if (table.groupId !== undefined && !groupIds.has(table.groupId)) {
      issues.push({
        code: "table-missing-group",
        severity: "error",
        message: `${capitalize(tableLabel(table))} is in a group that does not exist`,
        tableId: table.id,
        groupId: table.groupId,
      });
    }
  }
  return issues;
}

function checkTableNames(tables: Table[]): Issue[] {
  const issues: Issue[] = [];
  for (const table of tables) {
    if (isBlank(table.name)) {
      issues.push({
        code: "empty-table-name",
        severity: "error",
        message: "A table has no name",
        tableId: table.id,
      });
    }
  }
  for (const group of duplicates(tables)) {
    for (const table of group) {
      issues.push({
        code: "duplicate-table-name",
        severity: "error",
        message: `${group.length} tables are named "${table.name.trim()}"`,
        tableId: table.id,
      });
    }
  }
  return issues;
}

function checkTable(table: Table): Issue[] {
  const issues: Issue[] = [];
  const label = tableLabel(table);

  for (const column of table.columns) {
    if (isBlank(column.name)) {
      issues.push({
        code: "empty-column-name",
        severity: "error",
        message: `A column in ${label} has no name`,
        tableId: table.id,
        columnId: column.id,
      });
    }
  }
  for (const group of duplicates(table.columns)) {
    for (const column of group) {
      issues.push({
        code: "duplicate-column-name",
        severity: "error",
        message: `${group.length} columns in ${label} are named "${column.name.trim()}"`,
        tableId: table.id,
        columnId: column.id,
      });
    }
  }

  const primaryKey = table.columns.filter((c) => c.primaryKey);
  if (primaryKey.length === 0) {
    issues.push({
      code: "table-without-primary-key",
      severity: "warning",
      message: `${capitalize(label)} has no primary key`,
      tableId: table.id,
    });
  }
  for (const column of primaryKey.filter((c) => c.nullable)) {
    issues.push({
      code: "nullable-primary-key",
      severity: "warning",
      message: `Primary key column ${columnLabel(table, column)} allows null`,
      tableId: table.id,
      columnId: column.id,
    });
  }
  return issues;
}

function checkRelation(doc: Diagram, relation: Relation): Issue[] {
  const from = resolveEnd(doc, relation, relation.from);
  const to = resolveEnd(doc, relation, relation.to);
  if ("issue" in from || "issue" in to) {
    return [from, to].flatMap((end) => ("issue" in end ? [end.issue] : []));
  }

  const ref = { relationId: relation.id };
  const issues: Issue[] = [];

  if (from.columns.length !== to.columns.length) {
    issues.push({
      ...ref,
      code: "relation-column-count",
      severity: "error",
      message: `Relation from ${tableLabel(from.table)} to ${tableLabel(to.table)} uses ${from.columns.length} column(s) on one end and ${to.columns.length} on the other`,
    });
    return issues;
  }

  if (!isUniqueKey(to.table, relation.to.columnIds)) {
    issues.push({
      ...ref,
      code: "relation-target-not-unique",
      severity: "warning",
      message: `Relation points at columns of ${tableLabel(to.table)} that are not a primary key or unique`,
      tableId: to.table.id,
    });
  }

  from.columns.forEach((source, i) => {
    const target = to.columns[i]!;
    if (normalizeType(source.type) !== normalizeType(target.type)) {
      issues.push({
        ...ref,
        code: "relation-type-mismatch",
        severity: "warning",
        message: `${columnLabel(from.table, source)} (${source.type}) points at ${columnLabel(to.table, target)} (${target.type})`,
        tableId: from.table.id,
        columnId: source.id,
      });
    }
  });

  return issues;
}

type ResolvedEnd = { table: Table; columns: Column[] } | { issue: Issue };

function resolveEnd(
  doc: Diagram,
  relation: Relation,
  end: RelationEnd,
): ResolvedEnd {
  const table = doc.tables.find((t) => t.id === end.tableId);
  if (!table) {
    return {
      issue: {
        code: "relation-missing-table",
        severity: "error",
        message: `Relation points at a table that does not exist`,
        relationId: relation.id,
        tableId: end.tableId,
      },
    };
  }
  const columns: Column[] = [];
  for (const columnId of end.columnIds) {
    const column = table.columns.find((c) => c.id === columnId);
    if (!column) {
      return {
        issue: {
          code: "relation-missing-column",
          severity: "error",
          message: `Relation points at a column of ${tableLabel(table)} that does not exist`,
          relationId: relation.id,
          tableId: table.id,
          columnId,
        },
      };
    }
    columns.push(column);
  }
  return { table, columns };
}

// --- Helpers --------------------------------------------------------------

/** Groups of items that share a name (ignoring case and spaces). */
function duplicates<T extends { name: string }>(items: T[]): T[][] {
  const byName = new Map<string, T[]>();
  for (const item of items) {
    if (isBlank(item.name)) continue;
    const key = item.name.trim().toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), item]);
  }
  return [...byName.values()].filter((group) => group.length > 1);
}

function normalizeType(type: string): string {
  return type.trim().toLowerCase().replace(/\s+/g, " ");
}

function isBlank(name: string): boolean {
  return name.trim() === "";
}

function tableLabel(table: Table): string {
  return isBlank(table.name) ? "an unnamed table" : `table "${table.name}"`;
}

function columnLabel(table: Table, column: Column): string {
  const tableName = isBlank(table.name) ? "?" : table.name;
  const columnName = isBlank(column.name) ? "?" : column.name;
  return `"${tableName}.${columnName}"`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
