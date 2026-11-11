import type { Id } from "../../shared";
import type { Table } from "../../Tables";
import type { Diagram } from "./Diagram";

export type ChangeKind = "added" | "modified" | "removed";

/** One difference between the diagram and its base. */
export type DiagramChange =
  | {
      entity: "table";
      kind: ChangeKind;
      tableId: Id;
      name: string;
      fields?: string[];
    }
  | {
      entity: "column";
      kind: ChangeKind;
      tableId: Id;
      columnId: Id;
      name: string;
      fields?: string[];
    }
  | { entity: "relation"; kind: ChangeKind; relationId: Id; fields?: string[] }
  | {
      entity: "group";
      kind: ChangeKind;
      groupId: Id;
      name: string;
      fields?: string[];
    }
  | {
      entity: "enum";
      kind: ChangeKind;
      enumId: Id;
      name: string;
      fields?: string[];
    };

/**
 * What changed since the base was set, compared by id (so a rename is a
 * modification). Columns of added or removed tables are not listed one by
 * one. Returns null if the diagram has no base.
 */
export function diffDiagram(diagram: Diagram): DiagramChange[] | null {
  const base = diagram.base;
  if (!base) return null;
  const changes: DiagramChange[] = [];

  for (const { before, after, kind } of pair(base.tables, diagram.tables)) {
    const table = (after ?? before)!;
    if (kind !== "modified") {
      changes.push({
        entity: "table",
        kind,
        tableId: table.id,
        name: table.name,
      });
      continue;
    }
    const fields = changedFields(before!, after!, [
      "name",
      "comment",
      "groupId",
    ]);
    if (fields.length) {
      changes.push({
        entity: "table",
        kind,
        tableId: table.id,
        name: table.name,
        fields,
      });
    }
    changes.push(...columnChanges(before!, after!));
  }

  for (const { before, after, kind } of pair(
    base.relations,
    diagram.relations,
  )) {
    const relation = (after ?? before)!;
    const fields =
      kind === "modified"
        ? changedFields(before!, after!, [
            "name",
            "from",
            "to",
            "onDelete",
            "onUpdate",
          ])
        : [];
    if (kind !== "modified" || fields.length) {
      changes.push({
        entity: "relation",
        kind,
        relationId: relation.id,
        ...(fields.length ? { fields } : {}),
      });
    }
  }

  for (const { before, after, kind } of pair(base.groups, diagram.groups)) {
    const group = (after ?? before)!;
    const fields =
      kind === "modified"
        ? changedFields(before!, after!, ["name", "color", "note"])
        : [];
    if (kind !== "modified" || fields.length) {
      changes.push({
        entity: "group",
        kind,
        groupId: group.id,
        name: group.name,
        ...(fields.length ? { fields } : {}),
      });
    }
  }

  for (const { before, after, kind } of pair(base.enums, diagram.enums)) {
    const item = (after ?? before)!;
    const fields =
      kind === "modified"
        ? changedFields(before!, after!, ["name", "values", "note"])
        : [];
    if (kind !== "modified" || fields.length) {
      changes.push({
        entity: "enum",
        kind,
        enumId: item.id,
        name: item.name,
        ...(fields.length ? { fields } : {}),
      });
    }
  }

  return changes;
}

function columnChanges(before: Table, after: Table): DiagramChange[] {
  const changes: DiagramChange[] = [];
  for (const pairItem of pair(before.columns, after.columns)) {
    const column = (pairItem.after ?? pairItem.before)!;
    const fields =
      pairItem.kind === "modified"
        ? changedFields(pairItem.before!, pairItem.after!, [
            "name",
            "type",
            "primaryKey",
            "nullable",
            "unique",
            "autoIncrement",
            "default",
            "comment",
          ])
        : [];
    if (pairItem.kind !== "modified" || fields.length) {
      changes.push({
        entity: "column",
        kind: pairItem.kind,
        tableId: after.id,
        columnId: column.id,
        name: column.name,
        ...(fields.length ? { fields } : {}),
      });
    }
  }
  return changes;
}

/**
 * Matches items by id: those only in `after` are added, those only in
 * `before` removed, and those in both are candidates for modified.
 */
function pair<T extends { id: Id }>(
  before: readonly T[],
  after: readonly T[],
): { before?: T; after?: T; kind: ChangeKind }[] {
  const old = new Map(before.map((item) => [item.id, item]));
  const result: { before?: T; after?: T; kind: ChangeKind }[] = after.map(
    (item) =>
      old.has(item.id)
        ? { before: old.get(item.id)!, after: item, kind: "modified" }
        : { after: item, kind: "added" },
  );
  const current = new Set(after.map((item) => item.id));
  for (const item of before) {
    if (!current.has(item.id)) result.push({ before: item, kind: "removed" });
  }
  return result;
}

function changedFields<T extends object>(
  before: T,
  after: T,
  fields: (keyof T & string)[],
): string[] {
  return fields.filter(
    (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field]),
  );
}
