import { BaseEdge, Position, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import type { RelationEdge } from "../../utils/canvasElements";
import {
  childMark,
  parentMarks,
  relationCurve,
  type RelationEnd,
} from "../../utils/relationGeometry";

/** 1 when the line leaves the table to the right, -1 to the left. */
const outward = (position: Position): 1 | -1 =>
  position === Position.Left ? -1 : 1;

/**
 * A relation: a curve from the foreign key column to the column it points
 * at. The child end shows many (crow's foot) or one (bar); the parent end
 * shows two bars, or a bar and a circle when the foreign key can be empty.
 * With a table in focus, its relations are lit and the rest fade.
 */
export const RelationEdgeView = memo(function RelationEdgeView({
  source,
  target,
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationEdge>) {
  const child: RelationEnd = {
    x: sourceX,
    y: sourceY,
    out: outward(sourcePosition),
  };
  const parent: RelationEnd = {
    x: targetX,
    y: targetY,
    out: outward(targetPosition),
  };
  const path = relationCurve(child, parent, source === target);
  const many = data?.cardinality.kind !== "1:1";
  const ends = parentMarks(parent, data?.cardinality.optional ?? false);

  // A relation of the table in focus is lit; with a table in focus, the rest fade.
  const lit = selected || data?.emphasis === "high";
  const stroke = selected
    ? "stroke-accent-ink"
    : data?.change === "added"
      ? "stroke-added"
      : data?.change === "modified"
        ? "stroke-changed"
        : lit
          ? "stroke-accent-ink"
          : "stroke-relation";
  const width = lit ? 2.2 : 1.4;

  return (
    <g
      className={`transition-opacity duration-150 motion-reduce:transition-none ${data?.emphasis === "low" && !selected ? "opacity-[0.12]" : ""}`}
    >
      <BaseEdge
        path={path}
        className={stroke}
        style={{
          // Inline: React Flow's own stroke rule wins over a utility class.
          stroke: `var(--color-${stroke.slice("stroke-".length)})`,
          strokeWidth: width,
          // A relation that goes to another group is dashed.
          strokeDasharray: data?.crossesGroups ? "5 4" : undefined,
        }}
      />
      <path
        d={`${childMark(child, many)} ${ends.path}`}
        className={`fill-none ${stroke}`}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {ends.circle && (
        <circle
          cx={ends.circle.cx}
          cy={ends.circle.cy}
          r={3.6}
          className={`fill-canvas ${stroke}`}
          strokeWidth={width}
        />
      )}
    </g>
  );
});
