import {
  DEFAULT_LAYOUT_OPTIONS,
  layoutPositions,
  placementOrigin,
  toLayoutGraph,
  unplacedTableIds,
  type Diagram,
  type Id,
  type LayoutGraph,
  type LayoutNode,
  type Position,
  type Size,
} from "@design-db/core";

/** What lays out a graph: elkjs, in a Web Worker in the browser and directly in tests. */
export type Layouter = {
  layout(graph: LayoutGraph): Promise<{ children?: LayoutNode[] }>;
};

/** The spacing elkjs leaves between tables, which it applies only at the level it is set on. */
const SPACING = {
  "elk.spacing.nodeNode": DEFAULT_LAYOUT_OPTIONS["elk.spacing.nodeNode"]!,
  "elk.layered.spacing.nodeNodeBetweenLayers":
    DEFAULT_LAYOUT_OPTIONS["elk.layered.spacing.nodeNodeBetweenLayers"]!,
};

/** The graph with the spacing set inside every group too, so grouped tables keep room for their relations. */
export function withGroupSpacing(graph: LayoutGraph): LayoutGraph {
  return {
    ...graph,
    children: graph.children.map((node) =>
      node.children
        ? { ...node, layoutOptions: { ...SPACING, ...node.layoutOptions } }
        : node,
    ),
  };
}

/**
 * New positions for the tables of the diagram, laid out by elkjs with the
 * sizes the canvas draws them at. With `only`, just those tables are laid
 * out, to the right of the ones that keep their place.
 */
export async function autoLayout(
  diagram: Diagram,
  sizes: Partial<Record<Id, Size>>,
  layouter: Layouter,
  options: { only?: readonly Id[] } = {},
): Promise<Record<Id, Position>> {
  const { only } = options;
  if (only?.length === 0 || diagram.tables.length === 0) return {};

  const graph = toLayoutGraph(diagram, {
    sizes,
    ...(only ? { tableIds: only } : {}),
  });
  const laid = await layouter.layout(withGroupSpacing(graph));

  const keep = only ? new Set(only) : null;
  const rest = keep
    ? {
        ...diagram,
        layout: {
          ...diagram.layout,
          tables: Object.fromEntries(
            Object.entries(diagram.layout.tables).filter(
              ([id]) => !keep.has(id),
            ),
          ),
        },
      }
    : null;
  const offset = rest ? placementOrigin(rest, sizes) : { x: 0, y: 0 };

  const positions = layoutPositions(laid, offset);
  for (const id of Object.keys(positions)) {
    const at = positions[id]!;
    positions[id] = { x: Math.round(at.x), y: Math.round(at.y) };
  }
  return positions;
}

/** New positions for the tables that have none, as after an import. Nothing when every table has one. */
export function layoutUnplaced(
  diagram: Diagram,
  sizes: Partial<Record<Id, Size>>,
  layouter: Layouter,
): Promise<Record<Id, Position>> {
  return autoLayout(diagram, sizes, layouter, {
    only: unplacedTableIds(diagram),
  });
}
