import {
  apply,
  applyAll,
  createColumn,
  createManyToMany,
  createRelation,
  type Column,
  type Diagram,
  type Id,
  type Table,
} from "@design-db/core";
import { tableSize } from "./canvasElements";
import { referenceType, setColumnReference } from "./tableEdits";

/** A change to the diagram and what to tell the user about it. */
export type Edit = { diagram: Diagram; notice: string };

const isOnlyKey = (table: Table, column: Column): boolean =>
  column.primaryKey &&
  table.columns.filter((other) => other.primaryKey).length === 1;

function freeColumnName(table: Table, wanted: string): string {
  const used = new Set(
    table.columns.map((column) => column.name.toLowerCase()),
  );
  let name = wanted.toLowerCase();
  for (let number = 2; used.has(name); number++) {
    name = `${wanted.toLowerCase()}_${number}`;
  }
  return name;
}

/**
 * Relates two tables after a column was dragged from one onto the other.
 *
 * - The only primary key dropped on another table (not on a column): that
 *   table gets a new foreign key column pointing back at the key.
 * - Otherwise the dragged column becomes a foreign key to the column it was
 *   dropped on, or to the primary key of the table. Dragging a primary key
 *   onto a plain column turns it around: the plain column is the foreign key.
 *
 * Returns null when there is nothing to relate: a column dropped on itself,
 * or a column that is already part of a relation over several columns.
 */
export function linkColumns(
  diagram: Diagram,
  from: { tableId: Id; columnId: Id },
  to: { tableId: Id; columnId?: Id },
): Edit | null {
  let child = diagram.tables.find((table) => table.id === from.tableId);
  let parent = diagram.tables.find((table) => table.id === to.tableId);
  let childColumn = child?.columns.find((c) => c.id === from.columnId);
  if (!child || !parent || !childColumn) return null;

  if (
    to.columnId === undefined &&
    isOnlyKey(child, childColumn) &&
    child.id !== parent.id
  ) {
    const column = createColumn({
      name: freeColumnName(parent, `${child.name}_${childColumn.name}`),
      type: referenceType(childColumn.type),
      nullable: false,
    });
    return {
      diagram: applyAll(diagram, [
        { type: "column.add", tableId: parent.id, column },
        {
          type: "relation.add",
          relation: createRelation({
            from: { tableId: parent.id, columnIds: [column.id] },
            to: { tableId: child.id, columnIds: [childColumn.id] },
          }),
        },
      ]),
      notice: `Nueva columna ${parent.name}.${column.name} → ${child.name}.${childColumn.name}.`,
    };
  }

  let parentColumn =
    to.columnId === undefined
      ? (parent.columns.find((c) => c.primaryKey) ?? parent.columns[0])
      : parent.columns.find((c) => c.id === to.columnId);
  if (!parentColumn || parentColumn.id === childColumn.id) return null;

  if (isOnlyKey(child, childColumn) && !parentColumn.primaryKey) {
    [child, childColumn, parent, parentColumn] = [
      parent,
      parentColumn,
      child,
      childColumn,
    ];
  }

  const next = setColumnReference(diagram, child.id, childColumn.id, {
    tableId: parent.id,
    columnId: parentColumn.id,
  });
  if (next === diagram) return null;
  return {
    diagram: next,
    notice: `Relación ${child.name}.${childColumn.name} → ${parent.name}.${parentColumn.name}.`,
  };
}

/** Room left between the two tables and their join table. */
const JOIN_GAP = 48;

/** Whether two tables can be related many to many: both need a primary key. */
export function canRelateManyToMany(a: Table, b: Table): boolean {
  return [a, b].every((table) => table.columns.some((c) => c.primaryKey));
}

/**
 * Relates two tables many to many with a join table, placed under the two
 * tables and between them. Returns the id of the join table too.
 */
export function relateManyToMany(
  diagram: Diagram,
  aId: Id,
  bId: Id,
): Edit & { tableId: Id } {
  const created = createManyToMany(diagram, aId, bId);
  const tables = [aId, bId].flatMap((id) => {
    const table = diagram.tables.find((t) => t.id === id);
    const at = diagram.layout.tables[id];
    return table && at ? [{ at, size: tableSize(table) }] : [];
  });

  let next = created.diagram;
  if (tables.length === 2) {
    const [a, b] = tables as [(typeof tables)[0], (typeof tables)[0]];
    next = apply(next, {
      type: "table.move",
      tableId: created.tableId,
      position: {
        x: Math.round((a.at.x + b.at.x) / 2),
        y: Math.round(
          Math.max(a.at.y + a.size.height, b.at.y + b.size.height) + JOIN_GAP,
        ),
      },
    });
  }
  const join = next.tables.find((table) => table.id === created.tableId);
  return {
    diagram: next,
    tableId: created.tableId,
    notice: `Nueva tabla ${join?.name ?? ""} para la relación de muchos a muchos.`,
  };
}
