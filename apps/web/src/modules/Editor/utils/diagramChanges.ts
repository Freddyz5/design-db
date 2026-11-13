import {
  diffDiagram,
  type ChangeKind,
  type Column,
  type Diagram,
  type DiagramChange,
  type Id,
} from "@design-db/core";

/** What the canvas marks on one table when the changes are shown. */
export type TableMarks = {
  /** Added or modified, when the table itself is new or changed. */
  table?: Exclude<ChangeKind, "removed">;
  /** Added or modified columns. */
  columns: Record<Id, Exclude<ChangeKind, "removed">>;
  /** Columns the table had in the base and no longer has, shown struck through. */
  removed: Column[];
};

/** The marks for every table, and the added or modified relations. */
export type ChangeMarks = {
  tables: Record<Id, TableMarks>;
  relations: Record<Id, Exclude<ChangeKind, "removed">>;
};

/** What to mark on the canvas for the changes since the base. Empty when the diagram has no base. */
export function changeMarks(diagram: Diagram): ChangeMarks {
  const marks: ChangeMarks = { tables: {}, relations: {} };
  const changes = diffDiagram(diagram) ?? [];
  const forTable = (tableId: Id) =>
    (marks.tables[tableId] ??= { columns: {}, removed: [] });

  for (const change of changes) {
    if (change.entity === "table" && change.kind !== "removed") {
      forTable(change.tableId).table = change.kind;
    } else if (change.entity === "column") {
      const table = forTable(change.tableId);
      if (change.kind !== "removed") {
        table.columns[change.columnId] = change.kind;
        continue;
      }
      const old = diagram.base?.tables
        .find((t) => t.id === change.tableId)
        ?.columns.find((c) => c.id === change.columnId);
      if (old) table.removed.push(old);
    } else if (change.entity === "relation" && change.kind !== "removed") {
      marks.relations[change.relationId] = change.kind;
    }
  }
  return marks;
}

/** How many things were added, modified and removed. A table's own columns count with the table. */
export function changeCounts(
  changes: readonly DiagramChange[],
): Record<ChangeKind, number> {
  const counts: Record<ChangeKind, number> = {
    added: 0,
    modified: 0,
    removed: 0,
  };
  for (const change of changes) counts[change.kind]++;
  return counts;
}

const FIELD_NAMES: Record<string, string> = {
  name: "nombre",
  comment: "nota",
  note: "nota",
  groupId: "grupo",
  type: "tipo",
  primaryKey: "clave primaria",
  nullable: "obligatoria",
  unique: "única",
  autoIncrement: "autoincremental",
  default: "valor por defecto",
  from: "columnas",
  to: "destino",
  onDelete: "al eliminar",
  onUpdate: "al actualizar",
  color: "color",
  values: "valores",
};

const KIND_WORDS: Record<ChangeKind, string> = {
  added: "nueva",
  modified: "cambió",
  removed: "eliminada",
};

/** One change as the Cambios panel lists it. */
export type ChangeLine = {
  kind: ChangeKind;
  /** What changed, such as "Columna posts.title". */
  subject: string;
  /** Which fields changed, for a modification. */
  detail: string;
  /** The table to show when the line is picked, if it still exists. */
  tableId?: Id;
};

/** The changes since the base as the panel lists them, in Spanish. */
export function describeChanges(diagram: Diagram): ChangeLine[] {
  const changes = diffDiagram(diagram) ?? [];
  const tableName = (tableId: Id) =>
    diagram.tables.find((t) => t.id === tableId)?.name ??
    diagram.base?.tables.find((t) => t.id === tableId)?.name ??
    "?";
  const exists = (tableId: Id) => diagram.tables.some((t) => t.id === tableId);

  return changes.map((change): ChangeLine => {
    const detail = (change.fields ?? [])
      .map((field) => FIELD_NAMES[field] ?? field)
      .join(", ");
    const line = { kind: change.kind, detail };
    switch (change.entity) {
      case "table":
        return {
          ...line,
          subject: `Tabla ${change.name}`,
          ...(exists(change.tableId) ? { tableId: change.tableId } : {}),
        };
      case "column":
        return {
          ...line,
          subject: `Columna ${tableName(change.tableId)}.${change.name}`,
          ...(exists(change.tableId) ? { tableId: change.tableId } : {}),
        };
      case "relation": {
        const relation =
          diagram.relations.find((r) => r.id === change.relationId) ??
          diagram.base?.relations.find((r) => r.id === change.relationId);
        const from = relation ? tableName(relation.from.tableId) : "?";
        const to = relation ? tableName(relation.to.tableId) : "?";
        return {
          ...line,
          subject: `Relación ${from} → ${to}`,
          ...(relation && exists(relation.from.tableId)
            ? { tableId: relation.from.tableId }
            : {}),
        };
      }
      case "group":
        return { ...line, subject: `Grupo ${change.name}` };
      case "enum":
        return { ...line, subject: `Enum ${change.name}` };
    }
  });
}

/** The word for a kind of change, as a label. */
export const changeWord = (kind: ChangeKind): string => KIND_WORDS[kind];
