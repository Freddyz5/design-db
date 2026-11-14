import { BaseEdge, Position, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import type { RelationEdge } from "../../utils/canvasElements";
import {
  childMark,
  dimensionLabel,
  dimensionPoint,
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
 * With a table in focus, its relations are lit and the rest fade, and each
 * lit relation carries a dimension mark with its cardinality, as on a plan.
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

  // A relation of the table in focus is lit in cyan; with a table in focus, the rest fade.
  // Only a selected relation takes the orange pencil.
  const lit = selected || data?.emphasis === "high";
  const stroke = selected
    ? "stroke-accent-ink"
    : data?.change === "added"
      ? "stroke-added"
      : data?.change === "modified"
        ? "stroke-changed"
        : lit
          ? "stroke-relation-focus"
          : "stroke-relation";
  const width = lit ? 2.2 : 1.4;

  // The dimension mark: only on the relations in focus, so the plan stays clean.
  const label =
    lit && data && source !== target ? dimensionLabel(data.cardinality) : null;
  const at = dimensionPoint(child, parent);
  const labelWidth = label ? label.length * 6.4 + 12 : 0;

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
      {label && (
        <g
          transform={`translate(${at.x} ${at.y})`}
          className={stroke}
          aria-label={`Cardinalidad ${label}`}
        >
          <rect
            x={-labelWidth / 2}
            y={-9}
            width={labelWidth}
            height={18}
            className="fill-sheet"
            strokeWidth={1}
          />
          {/* The ticks of a dimension line, either side of the figure. */}
          <path
            d={`M${-labelWidth / 2 - 7} -5v10M${labelWidth / 2 + 7} -5v10`}
            strokeWidth={1}
          />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            className="font-mono text-[10.5px] font-semibold"
            style={{
              fill: `var(--color-${stroke.slice("stroke-".length)})`,
              stroke: "none",
            }}
          >
            {label}
          </text>
        </g>
      )}
    </g>
  );
});
