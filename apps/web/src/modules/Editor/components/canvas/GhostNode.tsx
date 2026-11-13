import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import {
  TABLE_HEADER_HEIGHT,
  TABLE_ROW_HEIGHT,
  TABLE_WIDTH,
} from "../../constants/canvas";
import type { GhostNode } from "../../utils/canvasElements";

/**
 * A table removed since the base, where it stood: a dashed outline in the
 * removed color, its name and columns struck through. It cannot be picked
 * or moved; it only shows what is about to go.
 */
export const GhostNodeView = memo(function GhostNodeView({
  data,
}: NodeProps<GhostNode>) {
  const { table, columns, dimmed } = data;
  return (
    <figure
      className={`m-0 cursor-default border-[1.5px] border-dashed border-removed bg-flap/60 text-removed transition-opacity duration-150 motion-reduce:transition-none ${dimmed ? "opacity-25" : "opacity-85"}`}
      style={{ width: TABLE_WIDTH }}
    >
      <figcaption
        className="flex items-center justify-between gap-2 px-2 font-display text-[15.5px] font-bold tracking-[0.06em]"
        style={{ height: TABLE_HEADER_HEIGHT }}
      >
        <span className="truncate line-through">{table.name}</span>
        <span className="flex-none rounded-[2px] bg-removed px-1 text-[11px] leading-4 tracking-[0.1em] text-panel uppercase">
          Eliminada
        </span>
      </figcaption>
      {columns.length > 0 && (
        <ul>
          {columns.map((column) => (
            <li
              key={column.id}
              className="grid grid-cols-[28%_27%_45%] items-center border-t border-dashed border-removed/40 font-mono text-[11px] line-through"
              style={{ height: TABLE_ROW_HEIGHT }}
            >
              <span className="truncate px-[5px]">{column.name}</span>
              <span className="truncate px-[5px]">{column.type}</span>
              <span />
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
});
