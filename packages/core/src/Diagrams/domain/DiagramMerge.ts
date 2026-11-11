import type { Column } from "../../Columns";
import { isEnumType, type Enum } from "../../Enums";
import type { Group } from "../../Groups";
import type { Relation, RelationEnd } from "../../Relations";
import { createId, type Id } from "../../shared";
import type { Table } from "../../Tables";
import type { Diagram, TableLayout } from "./Diagram";

export type MergeMode = "add" | "replace";

/**
 * Combines an imported diagram (e.g. read from SQL or DBML) with the
 * current one, as a single change.
 *
 * - `replace`: the result has the imported schema, but tables, columns,
 *   enums, groups and relations that already existed (same name, ignoring
 *   case) keep their id, position, color and group. If the import has no
 *   groups (SQL never has), the current groups are kept.
 * - `add`: the imported items are added with new ids. Tables whose name is
 *   taken are renamed (`users_2`), groups with the same name are merged and
 *   enums with the same name and values are reused. New tables get no
 *   position, so the editor can lay them out.
 *
 * The id, name, dialect and viewport of the current diagram are kept.
 */
export function mergeDiagram(
  current: Diagram,
  imported: Diagram,
  mode: MergeMode,
): Diagram {
  return mode === "replace"
    ? replaceDiagram(current, imported)
    : addDiagram(current, imported);
}

// --- Replace --------------------------------------------------------------

function replaceDiagram(current: Diagram, imported: Diagram): Diagram {
  const keepGroups = imported.groups.length === 0;

  const groupIds = new Map<Id, Id>();
  const groups: Group[] = keepGroups
    ? current.groups
    : imported.groups.map((g) => {
        const old = findByName(current.groups, g.name);
        const id = old?.id ?? g.id;
        groupIds.set(g.id, id);
        const color = g.color ?? old?.color;
        return { ...g, id, ...(color !== undefined ? { color } : {}) };
      });

  const enums: Enum[] = imported.enums.map((e) => {
    const old = findByName(current.enums, e.name);
    return old ? { ...e, id: old.id } : e;
  });

  const tableIds = new Map<Id, Id>();
  const columnIds = new Map<Id, Id>();
  const layoutTables: Record<Id, TableLayout> = {};
  const tables: Table[] = imported.tables.map((t) => {
    const old = findByName(current.tables, t.name);
    const id = old?.id ?? t.id;
    tableIds.set(t.id, id);

    const columns: Column[] = t.columns.map((c) => {
      const oldColumn = old ? findByName(old.columns, c.name) : undefined;
      const columnId = oldColumn?.id ?? c.id;
      columnIds.set(c.id, columnId);
      return { ...c, id: columnId };
    });

    const groupId = keepGroups
      ? old?.groupId
      : t.groupId !== undefined
        ? groupIds.get(t.groupId)
        : undefined;
    const { groupId: _ignored, ...rest } = t;

    const position =
      imported.layout.tables[t.id] ??
      (old ? current.layout.tables[old.id] : undefined);
    if (position) layoutTables[id] = position;

    return {
      ...rest,
      id,
      columns,
      ...(groupId !== undefined ? { groupId } : {}),
    };
  });

  const relations: Relation[] = imported.relations.map((r) => {
    const from = remapEnd(r.from, tableIds, columnIds);
    const to = remapEnd(r.to, tableIds, columnIds);
    const old = current.relations.find(
      (c) => sameEnd(c.from, from) && sameEnd(c.to, to),
    );
    return { ...r, id: old?.id ?? r.id, from, to };
  });

  return {
    ...current,
    tables,
    relations,
    groups,
    enums,
    layout: { ...current.layout, tables: layoutTables },
  };
}

// --- Add ------------------------------------------------------------------

function addDiagram(current: Diagram, imported: Diagram): Diagram {
  const fresh = reidentify(imported);

  const groupIds = new Map<Id, Id>();
  const groups = [...current.groups];
  for (const g of fresh.groups) {
    const existing = findByName(current.groups, g.name);
    if (existing) groupIds.set(g.id, existing.id);
    else {
      groups.push(g);
      groupIds.set(g.id, g.id);
    }
  }

  const enums = [...current.enums];
  const enumNames = new Set(current.enums.map((e) => key(e.name)));
  const typeRenames: [Enum, string][] = [];
  for (const e of fresh.enums) {
    const existing = findByName(current.enums, e.name);
    if (existing && sameValues(existing.values, e.values)) continue;
    if (existing) {
      const name = uniqueName(e.name, enumNames);
      typeRenames.push([e, name]);
      enums.push({ ...e, name });
    } else {
      enumNames.add(key(e.name));
      enums.push(e);
    }
  }

  const tableNames = new Set(current.tables.map((t) => key(t.name)));
  const added: Table[] = fresh.tables.map((t) => {
    const name = uniqueName(t.name, tableNames);
    const groupId =
      t.groupId !== undefined ? groupIds.get(t.groupId) : undefined;
    const { groupId: _ignored, ...rest } = t;
    const columns = t.columns.map((c) => {
      const renamed = typeRenames.find(([e]) => isEnumType(e, c.type));
      return renamed ? { ...c, type: renamed[1] } : c;
    });
    return {
      ...rest,
      name,
      columns,
      ...(groupId !== undefined ? { groupId } : {}),
    };
  });

  return {
    ...current,
    tables: [...current.tables, ...added],
    relations: [...current.relations, ...fresh.relations],
    groups,
    enums,
  };
}

/** A copy of the diagram where every item has a new id. */
function reidentify(doc: Diagram): Diagram {
  const ids = new Map<Id, Id>();
  const next = (id: Id) => {
    const fresh = createId();
    ids.set(id, fresh);
    return fresh;
  };
  const groups = doc.groups.map((g) => ({ ...g, id: next(g.id) }));
  const enums = doc.enums.map((e) => ({ ...e, id: next(e.id) }));
  const tables = doc.tables.map((t) => {
    const table: Table = {
      ...t,
      id: next(t.id),
      columns: t.columns.map((c) => ({ ...c, id: next(c.id) })),
    };
    if (t.groupId !== undefined) {
      const groupId = ids.get(t.groupId);
      if (groupId) table.groupId = groupId;
      else delete table.groupId;
    }
    return table;
  });
  const end = (e: RelationEnd): RelationEnd => ({
    tableId: ids.get(e.tableId) ?? e.tableId,
    columnIds: e.columnIds.map((id) => ids.get(id) ?? id),
  });
  const relations = doc.relations.map((r) => ({
    ...r,
    id: createId(),
    from: end(r.from),
    to: end(r.to),
  }));
  return { ...doc, tables, relations, groups, enums };
}

// --- Helpers --------------------------------------------------------------

function remapEnd(
  end: RelationEnd,
  tableIds: Map<Id, Id>,
  columnIds: Map<Id, Id>,
): RelationEnd {
  return {
    tableId: tableIds.get(end.tableId) ?? end.tableId,
    columnIds: end.columnIds.map((id) => columnIds.get(id) ?? id),
  };
}

function sameEnd(a: RelationEnd, b: RelationEnd): boolean {
  return (
    a.tableId === b.tableId &&
    a.columnIds.length === b.columnIds.length &&
    a.columnIds.every((id, i) => id === b.columnIds[i])
  );
}

function findByName<T extends { name: string }>(
  items: T[],
  name: string,
): T | undefined {
  return items.find((item) => key(item.name) === key(name));
}

function sameValues(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/** Adds _2, _3… until the name is free, and marks it as taken. */
function uniqueName(base: string, taken: Set<string>): string {
  let name = base;
  for (let n = 2; taken.has(key(name)); n++) name = `${base}_${n}`;
  taken.add(key(name));
  return name;
}

function key(name: string): string {
  return name.trim().toLowerCase();
}
