import type { Id } from "../../shared";
import type { Table } from "../../Tables";
import type { Diagram, Position } from "./Diagram";

export type Size = { width: number; height: number };

/** A node in the graph format of elkjs. Groups are nodes with children. */
export type LayoutNode = {
  id: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  children?: LayoutNode[];
  layoutOptions?: Record<string, string>;
};

export type LayoutEdge = { id: string; sources: string[]; targets: string[] };

/** The root of an elkjs graph. elkjs fills in `x` and `y` of each node. */
export type LayoutGraph = {
  id: string;
  layoutOptions?: Record<string, string>;
  children: LayoutNode[];
  edges: LayoutEdge[];
};

export const DEFAULT_LAYOUT_OPTIONS: Readonly<Record<string, string>> = {
  "elk.algorithm": "layered",
  "elk.direction": "RIGHT",
  "elk.hierarchyHandling": "INCLUDE_CHILDREN",
  "elk.spacing.nodeNode": "48",
  "elk.layered.spacing.nodeNodeBetweenLayers": "96",
};

/** Extra room at the top of a group for its name. */
const GROUP_OPTIONS = { "elk.padding": "[top=48,left=24,bottom=24,right=24]" };

const GROUP_PREFIX = "group:";
const HEADER_HEIGHT = 40;
const ROW_HEIGHT = 26;

/**
 * A rough size of a table on the canvas, from its name and columns. The
 * editor can pass the real sizes to `toLayoutGraph` instead.
 */
export function estimateTableSize(table: Table): Size {
  const longest = Math.max(
    table.name.length,
    ...table.columns.map((c) => c.name.length + c.type.length + 4),
  );
  return {
    width: Math.round(Math.min(420, Math.max(200, 32 + longest * 7.5))),
    height: HEADER_HEIGHT + table.columns.length * ROW_HEIGHT + 8,
  };
}

/**
 * Builds the graph that elkjs lays out: tables as nodes, groups as nodes
 * that contain their tables, and relations as edges from the referenced
 * table to the one with the foreign key. With `tableIds`, only those tables
 * (and the relations between them) are included.
 */
export function toLayoutGraph(
  diagram: Diagram,
  options: {
    tableIds?: readonly Id[];
    sizes?: Partial<Record<Id, Size>>;
    layoutOptions?: Record<string, string>;
  } = {},
): LayoutGraph {
  const wanted = options.tableIds ? new Set(options.tableIds) : undefined;
  const tables = diagram.tables.filter((t) => !wanted || wanted.has(t.id));
  const included = new Set(tables.map((t) => t.id));
  const groupIds = new Set(diagram.groups.map((g) => g.id));

  const node = (table: Table): LayoutNode => ({
    id: table.id,
    ...(options.sizes?.[table.id] ?? estimateTableSize(table)),
  });

  const children: LayoutNode[] = [];
  const containers = new Map<Id, LayoutNode>();
  for (const table of tables) {
    const groupId = table.groupId;
    if (groupId === undefined || !groupIds.has(groupId)) {
      children.push(node(table));
      continue;
    }
    let container = containers.get(groupId);
    if (!container) {
      container = {
        id: GROUP_PREFIX + groupId,
        layoutOptions: { ...GROUP_OPTIONS },
        children: [],
      };
      containers.set(groupId, container);
      children.push(container);
    }
    container.children!.push(node(table));
  }

  const edges = diagram.relations
    .filter(
      (r) =>
        r.from.tableId !== r.to.tableId &&
        included.has(r.from.tableId) &&
        included.has(r.to.tableId),
    )
    .map((r) => ({
      id: r.id,
      sources: [r.to.tableId],
      targets: [r.from.tableId],
    }));

  return {
    id: "root",
    layoutOptions: { ...DEFAULT_LAYOUT_OPTIONS, ...options.layoutOptions },
    children,
    edges,
  };
}

/**
 * Reads the table positions from a graph laid out by elkjs. Positions of
 * tables inside a group are relative to it, so they are made absolute.
 * `offset` moves every table, e.g. to place new tables next to old ones.
 */
export function layoutPositions(
  graph: { children?: LayoutNode[] },
  offset: Position = { x: 0, y: 0 },
): Record<Id, Position> {
  const positions: Record<Id, Position> = {};
  const visit = (nodes: LayoutNode[] | undefined, base: Position) => {
    for (const n of nodes ?? []) {
      const at = { x: base.x + (n.x ?? 0), y: base.y + (n.y ?? 0) };
      if (n.id.startsWith(GROUP_PREFIX)) visit(n.children, at);
      else if (n.x !== undefined && n.y !== undefined) positions[n.id] = at;
    }
  };
  visit(graph.children, offset);
  return positions;
}

/** Tables that have no position yet, e.g. right after an import. */
export function unplacedTableIds(diagram: Diagram): Id[] {
  return diagram.tables
    .filter((t) => diagram.layout.tables[t.id] === undefined)
    .map((t) => t.id);
}

/**
 * Where to put tables that have no position: to the right of the tables
 * that have one, aligned with the top. (0, 0) if none has a position.
 */
export function placementOrigin(
  diagram: Diagram,
  sizes: Partial<Record<Id, Size>> = {},
): Position {
  let right = -Infinity;
  let top = Infinity;
  for (const table of diagram.tables) {
    const at = diagram.layout.tables[table.id];
    if (!at) continue;
    const size = sizes[table.id] ?? estimateTableSize(table);
    right = Math.max(right, at.x + size.width);
    top = Math.min(top, at.y);
  }
  return Number.isFinite(right) ? { x: right + 96, y: top } : { x: 0, y: 0 };
}
