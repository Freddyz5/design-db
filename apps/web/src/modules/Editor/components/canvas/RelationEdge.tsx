import {
  BaseEdge,
  Position,
  getSmoothStepPath,
  type EdgeProps,
} from "@xyflow/react";
import { memo } from "react";
import type { RelationEdge } from "../../utils/canvasElements";

/** 1 when the line leaves the table to the right, -1 to the left. */
const outward = (position: Position): number =>
  position === Position.Left ? -1 : 1;

/** The mark for "many" at a table edge: a crow's foot opening toward the table. */
export const manyMark = (x: number, y: number, out: number): string =>
  `M${x + out * 12},${y} L${x},${y - 6} M${x + out * 12},${y} L${x},${y + 6}`;

/** The mark for "one": a bar across the line. */
export const oneMark = (x: number, y: number, out: number): string =>
  `M${x + out * 8},${y - 6} V${y + 6}`;

/**
 * A relation: a line from the foreign key column to the column it points at.
 * The child end shows many (crow's foot) or one (bar), with a circle when the
 * foreign key can be empty. The parent end is always one.
 */
export const RelationEdgeView = memo(function RelationEdgeView({
  sourceX,
  sourceY,
  sourcePosition,
  targetX,
  targetY,
  targetPosition,
  data,
  selected,
}: EdgeProps<RelationEdge>) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 5,
    offset: 24,
  });
  const child = outward(sourcePosition);
  const parent = outward(targetPosition);
  const many = data?.cardinality.kind !== "1:1";
  const childMark = many
    ? manyMark(sourceX, sourceY, child)
    : oneMark(sourceX, sourceY, child);

  const stroke = selected
    ? "stroke-lamp-ink"
    : data?.change === "added"
      ? "stroke-added"
      : data?.change === "modified"
        ? "stroke-changed"
        : "stroke-relation";
  const width = selected ? 2.2 : 1.4;

  return (
    <>
      <BaseEdge
        path={path}
        className={stroke}
        style={{
          strokeWidth: width,
          // A relation that goes to another group is dashed.
          strokeDasharray: data?.crossesGroups ? "5 4" : undefined,
        }}
      />
      <path
        d={`${childMark} ${oneMark(targetX, targetY, parent)}`}
        className={`fill-none ${stroke}`}
        strokeWidth={width}
        strokeLinecap="round"
      />
      {data?.cardinality.optional && (
        <circle
          cx={sourceX + child * 18}
          cy={sourceY}
          r={3.5}
          className={`fill-canvas ${stroke}`}
          strokeWidth={width}
        />
      )}
    </>
  );
});
