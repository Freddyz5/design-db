import { planManyToMany } from "../../Relations";
import type { Id } from "../../shared";
import { getTable, type Diagram, type Position } from "./Diagram";
import { applyAll } from "./DiagramOperations";

/**
 * Creates a many-to-many relation between two tables of the diagram: adds
 * the join table (placed between both) and its two relations.
 */
export function createManyToMany(
  doc: Diagram,
  tableAId: Id,
  tableBId: Id,
  options: { name?: string } = {},
): { diagram: Diagram; tableId: Id } {
  const a = getTable(doc, tableAId);
  const b = getTable(doc, tableBId);
  const plan = planManyToMany(a, b, {
    ...options,
    takenNames: doc.tables.map((t) => t.name),
  });

  const diagram = applyAll(doc, [
    { type: "table.add", table: plan.table, position: middle(doc, a.id, b.id) },
    ...plan.relations.map((relation) => ({
      type: "relation.add" as const,
      relation,
    })),
  ]);
  return { diagram, tableId: plan.table.id };
}

/** Halfway between both tables, so the join table appears between them. */
function middle(doc: Diagram, aId: Id, bId: Id): Position {
  const a = doc.layout.tables[aId];
  const b = doc.layout.tables[bId];
  if (a && b) return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const one = a ?? b;
  return one ? { x: one.x, y: one.y } : { x: 0, y: 0 };
}
