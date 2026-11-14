import {
  applyAll,
  createColumn,
  createTable,
  type Diagram,
  type Id,
  type Position,
  type Table,
} from "@design-db/core";

/** The first of tabla_1, tabla_2… that no table uses. Names compare without case, as in SQL. */
export function nextTableName(diagram: Diagram): string {
  const used = new Set(diagram.tables.map((table) => table.name.toLowerCase()));
  let number = diagram.tables.length + 1;
  while (used.has(`tabla_${number}`)) number++;
  return `tabla_${number}`;
}

/** A table to start from: a free name and an `id` primary key. */
export function createDefaultTable(diagram: Diagram): Table {
  return createTable({
    name: nextTableName(diagram),
    columns: [
      createColumn({
        name: "id",
        type: "int",
        primaryKey: true,
        autoIncrement: true,
      }),
    ],
  });
}

/** How far a new table steps aside when the spot is taken. */
const STEP = 24;

/**
 * `wanted`, or the nearest spot down and to the right where no table already
 * starts, so a new table never hides exactly behind another one.
 */
export function freePosition(diagram: Diagram, wanted: Position): Position {
  const taken = Object.values(diagram.layout.tables);
  const at = { x: Math.round(wanted.x), y: Math.round(wanted.y) };
  while (
    taken.some(
      (other) =>
        Math.abs(other.x - at.x) < STEP && Math.abs(other.y - at.y) < STEP,
    )
  ) {
    at.x += STEP;
    at.y += STEP;
  }
  return at;
}

/** The diagram without those tables (and without the relations that used them). */
export function removeTables(
  diagram: Diagram,
  tableIds: readonly Id[],
): Diagram {
  return applyAll(
    diagram,
    tableIds.map((tableId) => ({ type: "table.remove", tableId })),
  );
}

/** The diagram with those tables in a group, or in none when `groupId` is undefined. */
export function setTablesGroup(
  diagram: Diagram,
  tableIds: readonly Id[],
  groupId: Id | undefined,
): Diagram {
  return applyAll(
    diagram,
    tableIds.map((tableId) => ({
      type: "table.update",
      tableId,
      patch: { groupId },
    })),
  );
}
