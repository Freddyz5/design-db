import {
  getCardinality,
  placementOrigin,
  type Cardinality,
  type Column,
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
import { changeMarks, type TableMarks } from "./diagramChanges";
import { stripColors, type Strip } from "./groupColor";

/** Which columns the tables show: all, only the keys, or none (just the name). */
export type ColumnsFilter = "all" | "keys" | "name";
/** Which relations show: all, those inside a group, or those of the selected tables. */
export type RelationsFilter = "all" | "group" | "focus";

/** What of the view changes how the canvas is drawn. */
export type CanvasView = {
  /** Ids of the selected tables. */
  selection: readonly Id[];
  columns: ColumnsFilter;
  relations: RelationsFilter;
  /** The selected relation, if any. */
  selectedRelationId: Id | null;
  /** Mark what changed since the base. */
  showChanges: boolean;
};

const DEFAULT_VIEW: CanvasView = {
  selection: [],
  columns: "all",
  relations: "all",
  selectedRelationId: null,
  showChanges: false,
};

export type TableNodeData = {
  table: Table;
  strip: Strip;
  /** For each foreign key column, what it points at, such as "users.id". */
  references: Record<Id, string>;
  /** The columns the table shows now. */
  columns: Column[];
  /** How many columns the "keys" filter left out. */
  hidden: number;
  /** Faded: in "focus", a table that has nothing to do with the selected ones. */
  dimmed: boolean;
  /** What changed since the base, when the changes are shown. */
  marks: TableMarks | null;
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
  /** New or changed since the base, when the changes are shown. */
  change?: "added" | "modified";
};
export type RelationEdge = Edge<RelationEdgeData, "relation">;

/** The side of a table a relation leaves from: left or right. */
export type Side = "l" | "r";

/** The id of the connection point of a column on one side of its table. */
export const handleId = (columnId: Id, side: Side): string =>
  `${columnId}:${side}`;

/** The id of the connection point on the name strip, for a column that is not shown. */
export const stripHandleId = (side: Side): string => `strip:${side}`;

/** The id of the point a relation is dragged from. It is not where relations attach. */
export const dragHandleId = (columnId: Id): string => `${columnId}:drag`;

/** The column a drag started from, given the id of its drag point. */
export const dragHandleColumn = (handle: string): Id =>
  handle.slice(0, handle.lastIndexOf(":"));

/** The size of a table drawn with that many rows under its name. */
const sizeWithRows = (rows: number): Size => ({
  width: TABLE_WIDTH,
  height: TABLE_HEADER_HEIGHT + rows * TABLE_ROW_HEIGHT + TABLE_BORDER * 2,
});

/** The size a table has on the canvas with all its columns. */
export function tableSize(table: Table): Size {
  return sizeWithRows(table.columns.length);
}

/** The size a table has on the canvas as it is drawn now: its shown columns, and a row for the hidden ones. */
export function nodeSize(data: TableNodeData): Size {
  return sizeWithRows(
    data.columns.length +
      (data.marks?.removed.length ?? 0) +
      (data.hidden > 0 ? 1 : 0),
  );
}

/** The size of every table as the canvas draws it under a columns filter. */
export function drawnSizes(
  diagram: Diagram,
  columns: ColumnsFilter = "all",
): Record<Id, Size> {
  return Object.fromEntries(
    tableNodes(diagram, [], { columns }).map((node) => [
      node.id,
      nodeSize(node.data),
    ]),
  );
}

/** The columns a table shows under a filter. Keys are primary keys, unique columns and foreign keys. */
export function shownColumns(
  table: Table,
  references: Record<Id, string>,
  filter: ColumnsFilter,
): Column[] {
  if (filter === "all") return table.columns;
  if (filter === "name") return [];
  return table.columns.filter(
    (column) =>
      column.primaryKey || column.unique || references[column.id] !== undefined,
  );
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

function sameMarks(a: TableMarks | null, b: TableMarks | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.table === b.table &&
    sameRecord(a.columns, b.columns) &&
    a.removed.length === b.removed.length &&
    a.removed.every((column, index) => column === b.removed[index])
  );
}

function sameData(a: TableNodeData, b: TableNodeData): boolean {
  return (
    a.table === b.table &&
    a.strip.background === b.strip.background &&
    a.strip.ink === b.strip.ink &&
    a.hidden === b.hidden &&
    a.dimmed === b.dimmed &&
    sameMarks(a.marks, b.marks) &&
    a.columns.length === b.columns.length &&
    a.columns.every((column, index) => column === b.columns[index]) &&
    sameRecord(a.references, b.references)
  );
}

/** The tables that share a relation with one of `tableIds`, and those tables themselves. */
function relatedTo(diagram: Diagram, tableIds: readonly Id[]): Set<Id> {
  const related = new Set(tableIds);
  for (const relation of diagram.relations) {
    const child = relation.from.tableId;
    const parent = relation.to.tableId;
    if (tableIds.includes(child)) related.add(parent);
    if (tableIds.includes(parent)) related.add(child);
  }
  return related;
}

/**
 * The tables of the diagram as canvas nodes, drawn as the view asks: which
 * are selected, which columns show, which are faded. A node that did not
 * change is returned as the same object, and one that changed keeps what the
 * canvas knows about it (its measured size).
 */
export function tableNodes(
  diagram: Diagram,
  previous: readonly TableNode[] = [],
  view: Partial<CanvasView> = {},
): TableNode[] {
  const { selection, columns, relations, showChanges } = {
    ...DEFAULT_VIEW,
    ...view,
  };
  const before = new Map(previous.map((node) => [node.id, node]));
  const changes = showChanges ? changeMarks(diagram) : null;
  const noMarks: TableMarks = { columns: {}, removed: [] };
  const selected = new Set(selection);
  const unplaced = unplacedPositions(diagram);
  const focus =
    relations === "focus" && selection.length > 0
      ? relatedTo(diagram, selection)
      : null;

  return diagram.tables.map((table) => {
    const layout = diagram.layout.tables[table.id];
    const group = diagram.groups.find((g) => g.id === table.groupId);
    const at = layout ?? unplaced.get(table.id) ?? { x: 0, y: 0 };
    const references = referencesOf(diagram, table);
    const shown = shownColumns(table, references, columns);
    const data: TableNodeData = {
      table,
      strip: stripColors(layout?.color ?? group?.color),
      references,
      columns: shown,
      hidden: columns === "keys" ? table.columns.length - shown.length : 0,
      dimmed: focus !== null && !focus.has(table.id),
      marks: changes
        ? {
            ...noMarks,
            ...changes.tables[table.id],
            // Struck rows only make sense with every column shown.
            removed:
              columns === "all"
                ? (changes.tables[table.id]?.removed ?? [])
                : [],
          }
        : null,
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
      const size = nodeSize(node.data);
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
 * ahead of the diagram, and which columns each table shows: a relation to a
 * column that is not shown attaches to the name strip.
 *
 * The view decides which relations are drawn: all, those inside a group, or
 * those of the selected tables. The relations of the selected tables and the
 * selected relation are always drawn. An edge that did not change is returned
 * as the same object.
 */
export function relationEdges(
  diagram: Diagram,
  nodes: readonly TableNode[],
  previous: readonly RelationEdge[] = [],
  view: Partial<CanvasView> = {},
): RelationEdge[] {
  const { selection, relations, selectedRelationId, showChanges } = {
    ...DEFAULT_VIEW,
    ...view,
  };
  const before = new Map(previous.map((edge) => [edge.id, edge]));
  const x = new Map(nodes.map((node) => [node.id, node.position.x]));
  const changed = showChanges ? changeMarks(diagram).relations : {};
  const shown = new Map(
    nodes.map((node) => [
      node.id,
      new Set(node.data.columns.map((column) => column.id)),
    ]),
  );
  const handle = (tableId: Id, columnId: Id, side: Side) =>
    shown.get(tableId)?.has(columnId)
      ? handleId(columnId, side)
      : stripHandleId(side);

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

    const focused =
      relation.id === selectedRelationId ||
      selection.includes(relation.from.tableId) ||
      selection.includes(relation.to.tableId);
    if (!focused && relations === "focus") return [];
    if (!focused && relations === "group" && crossesGroups) return [];

    const [childSide, parentSide] = relationSides(
      x.get(relation.from.tableId) ?? 0,
      x.get(relation.to.tableId) ?? 0,
    );
    const edge: RelationEdge = {
      id: relation.id,
      type: "relation",
      source: relation.from.tableId,
      target: relation.to.tableId,
      sourceHandle: handle(relation.from.tableId, childColumn, childSide),
      targetHandle: handle(relation.to.tableId, parentColumn, parentSide),
      selected: relation.id === selectedRelationId,
      data: {
        cardinality,
        crossesGroups,
        ...(changed[relation.id] ? { change: changed[relation.id] } : {}),
      },
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
      old.data.crossesGroups === crossesGroups &&
      old.data.change === changed[relation.id];
    return [same ? old : edge];
  });
}
