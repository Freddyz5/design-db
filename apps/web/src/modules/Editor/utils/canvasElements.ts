import {
  getCardinality,
  placementOrigin,
  type Cardinality,
  type Diagram,
  type Group,
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

export type GroupNodeData = {
  group: Group;
  /** The color of the group, as a CSS color. */
  color: string;
  /** How many tables the group has. */
  count: number;
};
/** The node type is "zone": React Flow styles its own "group" type. */
export type GroupNode = Node<GroupNodeData, "zone">;

export type CanvasNode = TableNode | GroupNode;

export type RelationEdgeData = {
  cardinality: Cardinality;
  /** The two tables are not in the same group. */
  crossesGroups: boolean;
};
export type RelationEdge = Edge<RelationEdgeData, "relation">;

/** The side of a table a relation leaves from: left or right. */
export type Side = "l" | "r";

/** The id of the connection point of a column on one side of its table. */
export const handleId = (columnId: Id, side: Side): string =>
  `${columnId}:${side}`;

/** The id of the point a relation is dragged from. It is not where relations attach. */
export const dragHandleId = (columnId: Id): string => `${columnId}:drag`;

/** The column a drag started from, given the id of its drag point. */
export const dragHandleColumn = (handle: string): Id =>
  handle.slice(0, handle.lastIndexOf(":"));

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
 * The tables of the diagram as canvas nodes, selected when their id is in
 * `selection`. A node that did not change is returned as the same object, and
 * one that changed keeps what the canvas knows about it (its measured size).
 */
export function tableNodes(
  diagram: Diagram,
  previous: readonly TableNode[] = [],
  selection: readonly Id[] = [],
): TableNode[] {
  const before = new Map(previous.map((node) => [node.id, node]));
  const selected = new Set(selection);
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
      (old.selected ?? false) === selected.has(table.id) &&
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
      selected: selected.has(table.id),
      ariaLabel: `Tabla ${table.name}`,
    };
  });
}

/** The id of the canvas node of a group. Table nodes use the id of the table. */
export const groupNodeId = (groupId: Id): string => `group:${groupId}`;

/** The room a group leaves around its tables; the top holds its name. */
export const GROUP_PADDING = { top: 64, side: 24, bottom: 24 };

/**
 * The groups of the diagram as canvas nodes: a region behind the tables of
 * each group, sized from where those tables are now. A group without tables
 * has no region. A node that did not change is returned as the same object.
 */
export function groupNodes(
  diagram: Diagram,
  tables: readonly TableNode[],
  previous: readonly GroupNode[] = [],
): GroupNode[] {
  const before = new Map(previous.map((node) => [node.id, node]));

  return diagram.groups.flatMap((group) => {
    const members = tables.filter(
      (node) => node.data.table.groupId === group.id,
    );
    if (members.length === 0) return [];

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const node of members) {
      const size = tableSize(node.data.table);
      left = Math.min(left, node.position.x);
      top = Math.min(top, node.position.y);
      right = Math.max(right, node.position.x + size.width);
      bottom = Math.max(bottom, node.position.y + size.height);
    }
    const x = left - GROUP_PADDING.side;
    const y = top - GROUP_PADDING.top;
    const width = right - left + GROUP_PADDING.side * 2;
    const height = bottom - top + GROUP_PADDING.top + GROUP_PADDING.bottom;
    const color = stripColors(group.color).background;

    const id = groupNodeId(group.id);
    const old = before.get(id);
    if (
      old &&
      old.position.x === x &&
      old.position.y === y &&
      old.width === width &&
      old.height === height &&
      old.data.group === group &&
      old.data.color === color &&
      old.data.count === members.length
    ) {
      return [old];
    }
    return [
      {
        id,
        type: "zone",
        position: { x, y },
        width,
        height,
        data: { group, color, count: members.length },
        // Behind the tables and the relations. Only its label takes the pointer.
        zIndex: -1,
        selectable: false,
        focusable: false,
        dragHandle: ".group-handle",
        style: { pointerEvents: "none" },
      },
    ];
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
 * ahead of the diagram. The edge of `selectedId` is selected. An edge that did
 * not change is returned as the same object.
 */
export function relationEdges(
  diagram: Diagram,
  nodes: readonly TableNode[],
  previous: readonly RelationEdge[] = [],
  selectedId: Id | null = null,
): RelationEdge[] {
  const before = new Map(previous.map((edge) => [edge.id, edge]));
  const x = new Map(nodes.map((node) => [node.id, node.position.x]));

  return diagram.relations.flatMap((relation) => {
    const cardinality = getCardinality(diagram, relation);
    const group = (tableId: Id) =>
      diagram.tables.find((table) => table.id === tableId)?.groupId;
    const crossesGroups =
      group(relation.from.tableId) !== group(relation.to.tableId);
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
      selected: relation.id === selectedId,
      data: { cardinality, crossesGroups },
    };

    const old = before.get(relation.id);
    const same =
      old &&
      old.source === edge.source &&
      old.target === edge.target &&
      old.sourceHandle === edge.sourceHandle &&
      old.targetHandle === edge.targetHandle &&
      (old.selected ?? false) === edge.selected &&
      old.data?.cardinality.kind === cardinality.kind &&
      old.data.cardinality.optional === cardinality.optional &&
      old.data.crossesGroups === crossesGroups;
    return [same ? old : edge];
  });
}
