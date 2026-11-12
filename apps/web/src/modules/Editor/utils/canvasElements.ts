import {
  getCardinality,
  placementOrigin,
  type Cardinality,
  type Diagram,
  type Id,
  type Position,
  type Size,
  type Table,
} from "@design-db/core";
import type { Edge, Node } from "@xyflow/react";
import {
  TABLE_BORDER,
  TABLE_HEADER_HEIGHT,
  TABLE_ROW_HEIGHT,
  TABLE_WIDTH,
} from "../constants/canvas";
import { stripColors, type Strip } from "./groupColor";

export type TableNodeData = {
  table: Table;
  strip: Strip;
  /** For each foreign key column, what it points at, such as "users.id". */
  references: Record<Id, string>;
};
export type TableNode = Node<TableNodeData, "table">;

export type RelationEdgeData = { cardinality: Cardinality };
export type RelationEdge = Edge<RelationEdgeData, "relation">;

/** The side of a table a relation leaves from: left or right. */
export type Side = "l" | "r";

/** The id of the connection point of a column on one side of its table. */
export const handleId = (columnId: Id, side: Side): string =>
  `${columnId}:${side}`;

/** The size a table has on the canvas. */
export function tableSize(table: Table): Size {
  return {
    width: TABLE_WIDTH,
    height:
      TABLE_HEADER_HEIGHT +
      table.columns.length * TABLE_ROW_HEIGHT +
      TABLE_BORDER * 2,
  };
}

/** Space between the tables that have no position yet. */
const UNPLACED_GAP = 24;

/** Tables without a position go in a column to the right of the rest. */
function unplacedPositions(diagram: Diagram): Map<Id, Position> {
  const sizes = Object.fromEntries(
    diagram.tables.map((table) => [table.id, tableSize(table)]),
  );
  const origin = placementOrigin(diagram, sizes);
  const positions = new Map<Id, Position>();
  let y = origin.y;
  for (const table of diagram.tables) {
    if (diagram.layout.tables[table.id]) continue;
    positions.set(table.id, { x: origin.x, y });
    y += tableSize(table).height + UNPLACED_GAP;
  }
  return positions;
}

function referencesOf(diagram: Diagram, table: Table): Record<Id, string> {
  const references: Record<Id, string> = {};
  for (const relation of diagram.relations) {
    if (relation.from.tableId !== table.id) continue;
    const parent = diagram.tables.find((t) => t.id === relation.to.tableId);
    relation.from.columnIds.forEach((columnId, index) => {
      const target = parent?.columns.find(
        (column) => column.id === relation.to.columnIds[index],
      );
      if (parent && target) {
        references[columnId] = `${parent.name}.${target.name}`;
      }
    });
  }
  return references;
}

function sameRecord(a: Record<string, string>, b: Record<string, string>) {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => a[key] === b[key])
  );
}

function sameData(a: TableNodeData, b: TableNodeData): boolean {
  return (
    a.table === b.table &&
    a.strip.background === b.strip.background &&
    a.strip.ink === b.strip.ink &&
    sameRecord(a.references, b.references)
  );
}

/**
 * The tables of the diagram as canvas nodes. A node that did not change is
 * returned as the same object, and one that changed keeps what the canvas
 * knows about it (its measured size, whether it is selected).
 */
export function tableNodes(
  diagram: Diagram,
  previous: readonly TableNode[] = [],
): TableNode[] {
  const before = new Map(previous.map((node) => [node.id, node]));
  const unplaced = unplacedPositions(diagram);

  return diagram.tables.map((table) => {
    const layout = diagram.layout.tables[table.id];
    const group = diagram.groups.find((g) => g.id === table.groupId);
    const at = layout ?? unplaced.get(table.id) ?? { x: 0, y: 0 };
    const data: TableNodeData = {
      table,
      strip: stripColors(layout?.color ?? group?.color),
      references: referencesOf(diagram, table),
    };

    const old = before.get(table.id);
    if (
      old &&
      old.position.x === at.x &&
      old.position.y === at.y &&
      sameData(old.data, data)
    ) {
      return old;
    }
    return {
      ...old,
      id: table.id,
      type: "table",
      position: { x: at.x, y: at.y },
      data,
      ariaLabel: `Tabla ${table.name}`,
    };
  });
}

/**
 * Which side each end of a relation uses, from where the two tables are:
 * the sides that face each other, or both right sides when one table is
 * above the other.
 */
export function relationSides(childX: number, parentX: number): [Side, Side] {
  if (childX >= parentX + TABLE_WIDTH) return ["l", "r"];
  if (parentX >= childX + TABLE_WIDTH) return ["r", "l"];
  return ["r", "r"];
}

/**
 * The relations of the diagram as canvas edges, from the child column to the
 * parent column. `nodes` gives the current positions, which during a drag are
 * ahead of the diagram. An edge that did not change is returned as the same object.
 */
export function relationEdges(
  diagram: Diagram,
  nodes: readonly TableNode[],
  previous: readonly RelationEdge[] = [],
): RelationEdge[] {
  const before = new Map(previous.map((edge) => [edge.id, edge]));
  const x = new Map(nodes.map((node) => [node.id, node.position.x]));

  return diagram.relations.flatMap((relation) => {
    const cardinality = getCardinality(diagram, relation);
    // A relation over several columns is drawn from its first pair.
    const childColumn = relation.from.columnIds[0];
    const parentColumn = relation.to.columnIds[0];
    if (!cardinality || !childColumn || !parentColumn) return [];

    const [childSide, parentSide] = relationSides(
      x.get(relation.from.tableId) ?? 0,
      x.get(relation.to.tableId) ?? 0,
    );
    const edge: RelationEdge = {
      id: relation.id,
      type: "relation",
      source: relation.from.tableId,
      target: relation.to.tableId,
      sourceHandle: handleId(childColumn, childSide),
      targetHandle: handleId(parentColumn, parentSide),
      data: { cardinality },
    };

    const old = before.get(relation.id);
    const same =
      old &&
      old.source === edge.source &&
      old.target === edge.target &&
      old.sourceHandle === edge.sourceHandle &&
      old.targetHandle === edge.targetHandle &&
      old.data?.cardinality.kind === cardinality.kind &&
      old.data.cardinality.optional === cardinality.optional;
    return [same ? old : edge];
  });
}
