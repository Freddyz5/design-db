import { createColumn, type Column } from "../../Columns";
import { createDiagram, type Diagram } from "../../Diagrams";
import { createEnum, type Enum } from "../../Enums";
import { createGroup, type Group } from "../../Groups";
import {
  createRelation,
  planManyToMany,
  type RefAction,
  type Relation,
} from "../../Relations";
import { OperationError, type Dialect, type Id } from "../../shared";
import { createTable, isUniqueKey, type Table } from "../../Tables";

/** A problem found while reading a schema, with its line (1-based). */
export type ImportIssue = { message: string; line: number };

/**
 * What the SQL and DBML readers produce: the schema by names, before ids
 * exist. `buildDiagram` turns it into a diagram.
 */
export type SchemaDraft = {
  name?: string;
  dialect?: Dialect;
  tables: DraftTable[];
  refs: DraftRef[];
  enums: DraftEnum[];
  groups: DraftGroup[];
};

export type DraftColumn = {
  name: string;
  type: string;
  primaryKey: boolean;
  nullable: boolean;
  unique: boolean;
  autoIncrement: boolean;
  default?: string;
  comment?: string;
};

export type DraftTable = {
  name: string;
  comment?: string;
  columns: DraftColumn[];
  /** Composite or table-level primary key, by column name. */
  primaryKey?: string[];
  line: number;
};

export type DraftRef = {
  name?: string;
  /** The table with the foreign key (the "many" side). */
  fromTable: string;
  fromColumns: string[];
  toTable: string;
  /** Without columns, the relation points at the primary key of `toTable`. */
  toColumns?: string[];
  onDelete?: RefAction;
  onUpdate?: RefAction;
  kind: "many-to-one" | "one-to-one" | "many-to-many";
  line: number;
};

export type DraftEnum = { name: string; values: string[]; note?: string };

export type DraftGroup = {
  name: string;
  tables: string[];
  color?: string;
  note?: string;
  line: number;
};

export function emptyDraft(): SchemaDraft {
  return { tables: [], refs: [], enums: [], groups: [] };
}

export function draftColumn(name: string): DraftColumn {
  return {
    name,
    type: "",
    primaryKey: false,
    nullable: true,
    unique: false,
    autoIncrement: false,
  };
}

/**
 * Builds a diagram from a draft. Names are matched ignoring case. Tables
 * get no position: the editor lays them out. Anything that cannot be
 * resolved (a ref to a missing table, a repeated table…) is skipped and
 * reported as a warning.
 */
export function buildDiagram(draft: SchemaDraft): {
  diagram: Diagram;
  warnings: ImportIssue[];
} {
  const warnings: ImportIssue[] = [];
  const warn = (message: string, line: number) =>
    warnings.push({ message, line });

  const enums: Enum[] = [];
  for (const item of draft.enums) {
    if (enums.some((e) => same(e.name, item.name))) continue;
    enums.push(
      createEnum({
        name: item.name,
        values: item.values,
        ...(item.note ? { note: item.note } : {}),
      }),
    );
  }

  const groups: Group[] = [];
  const groupOf = new Map<string, Id>();
  for (const item of draft.groups) {
    const group = createGroup({
      name: item.name,
      ...(item.color ? { color: item.color } : {}),
      ...(item.note ? { note: item.note } : {}),
    });
    groups.push(group);
    for (const tableName of item.tables) {
      const key = tableName.toLowerCase();
      if (groupOf.has(key)) {
        warn(`Table "${tableName}" is in more than one group`, item.line);
      } else groupOf.set(key, group.id);
    }
  }

  const tables: Table[] = [];
  for (const item of draft.tables) {
    if (tables.some((t) => same(t.name, item.name))) {
      warn(
        `Table "${item.name}" is defined twice; the second one was skipped`,
        item.line,
      );
      continue;
    }
    const pkNames = (item.primaryKey ?? []).map((n) => n.toLowerCase());
    for (const name of item.primaryKey ?? []) {
      if (!item.columns.some((c) => same(c.name, name))) {
        warn(
          `Primary key column "${name}" not found in "${item.name}"`,
          item.line,
        );
      }
    }
    const columns: Column[] = item.columns.map((c) => {
      const primaryKey = c.primaryKey || pkNames.includes(c.name.toLowerCase());
      return createColumn({
        name: c.name,
        type: c.type.trim() || "text",
        primaryKey,
        nullable: primaryKey ? false : c.nullable,
        unique: c.unique,
        autoIncrement: c.autoIncrement,
        ...(c.default !== undefined ? { default: c.default } : {}),
        ...(c.comment ? { comment: c.comment } : {}),
      });
    });
    const groupId = groupOf.get(item.name.toLowerCase());
    tables.push(
      createTable({
        name: item.name,
        columns,
        ...(item.comment ? { comment: item.comment } : {}),
        ...(groupId ? { groupId } : {}),
      }),
    );
  }

  for (const item of draft.groups) {
    for (const tableName of item.tables) {
      if (!tables.some((t) => same(t.name, tableName))) {
        warn(
          `Group "${item.name}" lists a table that does not exist: "${tableName}"`,
          item.line,
        );
      }
    }
  }

  const relations: Relation[] = [];
  for (const ref of draft.refs) {
    const child = tables.find((t) => same(t.name, ref.fromTable));
    const parent = tables.find((t) => same(t.name, ref.toTable));
    if (!child || !parent) {
      const missing = child ? ref.toTable : ref.fromTable;
      warn(`Relation skipped: table "${missing}" does not exist`, ref.line);
      continue;
    }

    if (ref.kind === "many-to-many") {
      try {
        const plan = planManyToMany(child, parent, {
          takenNames: tables.map((t) => t.name),
        });
        tables.push(plan.table);
        relations.push(...plan.relations);
      } catch (error) {
        if (!(error instanceof OperationError)) throw error;
        warn(`Many-to-many relation skipped: ${error.message}`, ref.line);
      }
      continue;
    }

    const fromColumns = findColumns(child, ref.fromColumns);
    const toColumns = ref.toColumns
      ? findColumns(parent, ref.toColumns)
      : primaryKeyOf(parent);
    if (!fromColumns || !toColumns) {
      warn(
        `Relation from "${child.name}" to "${parent.name}" skipped: a column does not exist`,
        ref.line,
      );
      continue;
    }

    if (
      ref.kind === "one-to-one" &&
      !isUniqueKey(
        child,
        fromColumns.map((c) => c.id),
      )
    ) {
      if (fromColumns.length === 1) {
        const index = tables.indexOf(child);
        const unique = {
          ...child,
          columns: child.columns.map((c) =>
            c.id === fromColumns[0]!.id ? { ...c, unique: true } : c,
          ),
        };
        tables[index] = unique;
      } else {
        warn(
          `One-to-one relation on several columns is kept as one-to-many`,
          ref.line,
        );
      }
    }

    relations.push(
      createRelation({
        from: { tableId: child.id, columnIds: fromColumns.map((c) => c.id) },
        to: { tableId: parent.id, columnIds: toColumns.map((c) => c.id) },
        onDelete: ref.onDelete ?? "no action",
        onUpdate: ref.onUpdate ?? "no action",
        ...(ref.name ? { name: ref.name } : {}),
      }),
    );
  }

  const diagram: Diagram = {
    ...createDiagram({
      ...(draft.name ? { name: draft.name } : {}),
      dialect: draft.dialect ?? "generic",
    }),
    tables,
    relations,
    groups,
    enums,
  };
  return { diagram, warnings };
}

function findColumns(table: Table, names: string[]): Column[] | undefined {
  const columns = names.map((n) => table.columns.find((c) => same(c.name, n)));
  return columns.every((c) => c !== undefined) && columns.length > 0
    ? (columns as Column[])
    : undefined;
}

function primaryKeyOf(table: Table): Column[] | undefined {
  const key = table.columns.filter((c) => c.primaryKey);
  return key.length ? key : undefined;
}

function same(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}
