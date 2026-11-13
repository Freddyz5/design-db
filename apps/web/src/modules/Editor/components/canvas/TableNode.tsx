import type { Column } from "@design-db/core";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import {
  TABLE_HEADER_HEIGHT,
  TABLE_ROW_HEIGHT,
  TABLE_WIDTH,
} from "../../constants/canvas";
import {
  dragHandleId,
  handleId,
  stripHandleId,
  type TableNode,
} from "../../utils/canvasElements";

/** Where relations attach. Invisible: one point on each side of the row. */
const ANCHOR =
  "!h-px !min-h-0 !w-px !min-w-0 !border-0 !bg-transparent !opacity-0";

/** The point to drag a relation from. It shows when the pointer is over the table. */
const DRAG_POINT =
  "!size-[11px] !border-[1.5px] !border-lamp-ink !bg-raised opacity-0 transition-opacity duration-100 group-hover:opacity-100 hover:!bg-lamp [.linking_&]:opacity-100";

/** The lamp of a changed column: a small square before its name. */
const CHANGE_LAMP: Record<
  "added" | "modified",
  { className: string; label: string }
> = {
  added: { className: "bg-added", label: "Columna nueva" },
  modified: { className: "bg-changed", label: "Columna que cambió" },
};

function ColumnRow({
  column,
  reference,
  change,
}: {
  column: Column;
  reference: string | undefined;
  change?: "added" | "modified";
}) {
  const flags = [
    column.primaryKey ? "PK" : null,
    column.unique && !column.primaryKey ? "UQ" : null,
    column.nullable ? "NULL" : null,
  ].filter((flag) => flag !== null);
  const detail = [...flags, reference ? `→ ${reference}` : null]
    .filter((part) => part !== null)
    .join(" ");

  return (
    <li
      className={`relative grid grid-cols-[31%_31%_38%] items-center border-t border-flap-seam font-mono text-[11px] ${column.primaryKey ? "bg-key" : ""}`}
      style={{ height: TABLE_ROW_HEIGHT }}
      data-column-id={column.id}
    >
      <span
        className="flex min-w-0 items-center gap-1 px-[5px]"
        title={column.name}
      >
        {change && (
          <span
            className={`size-1.5 flex-none ${CHANGE_LAMP[change].className}`}
            role="img"
            aria-label={CHANGE_LAMP[change].label}
          />
        )}
        <span className="truncate">{column.name}</span>
      </span>
      <span
        className="truncate border-l border-flap-seam px-[5px] text-flap-muted"
        title={column.type}
      >
        {column.type}
      </span>
      <span
        className={`flex min-w-0 items-center gap-1 self-stretch border-l border-flap-seam px-[5px] ${column.primaryKey ? "text-key-ink" : "text-flap-muted"}`}
        title={detail}
      >
        {flags.length > 0 && (
          <span className="font-display text-[11px] font-semibold tracking-[0.08em]">
            {flags.join(" ")}
          </span>
        )}
        {reference && (
          <span className="truncate text-[10.5px]">→ {reference}</span>
        )}
      </span>
      <Handle
        type="source"
        position={Position.Left}
        id={handleId(column.id, "l")}
        isConnectable={false}
        className={ANCHOR}
      />
      <Handle
        type="source"
        position={Position.Right}
        id={handleId(column.id, "r")}
        isConnectable={false}
        className={ANCHOR}
      />
      <Handle
        type="source"
        position={Position.Right}
        id={dragHandleId(column.id)}
        className={DRAG_POINT}
        title="Arrastra hasta otra tabla para relacionarlas"
      />
    </li>
  );
}

/** A table on the canvas: a strip with its name in the group color, and one row per column. */
export const TableNodeView = memo(function TableNodeView({
  data,
  selected,
}: NodeProps<TableNode>) {
  const { table, strip, references, columns, hidden, dimmed, marks } = data;

  return (
    <div
      className={`group border-[1.5px] border-flap-edge bg-flap text-flap-ink shadow-float transition-opacity duration-150 ${selected ? "outline-[3px] outline-lamp" : ""} ${dimmed ? "opacity-30" : ""}`}
      style={{ width: TABLE_WIDTH }}
      data-table-id={table.id}
    >
      <div
        className="relative flex items-center justify-between gap-2 px-2 font-display text-[15.5px] font-bold tracking-[0.06em]"
        style={{
          height: TABLE_HEADER_HEIGHT,
          backgroundColor: strip.background,
          color: strip.ink,
        }}
      >
        <span className="truncate" title={table.name}>
          {table.name}
        </span>
        {marks?.table && (
          <span
            className={`ml-auto rounded-[2px] px-1 text-[10.5px] leading-4 tracking-[0.1em] text-panel uppercase ${marks.table === "added" ? "bg-added" : "bg-changed"}`}
          >
            {marks.table === "added" ? "Nueva" : "Cambió"}
          </span>
        )}
        <span
          className="font-mono text-[11px] font-medium opacity-80"
          title={`${table.columns.length} columnas`}
        >
          {table.columns.length}
        </span>
        {/* Where a relation attaches when its column is not shown. */}
        <Handle
          type="source"
          position={Position.Left}
          id={stripHandleId("l")}
          isConnectable={false}
          className={ANCHOR}
        />
        <Handle
          type="source"
          position={Position.Right}
          id={stripHandleId("r")}
          isConnectable={false}
          className={ANCHOR}
        />
      </div>
      <ul>
        {columns.map((column) => (
          <ColumnRow
            key={column.id}
            column={column}
            reference={references[column.id]}
            {...(marks?.columns[column.id]
              ? { change: marks.columns[column.id] }
              : {})}
          />
        ))}
        {marks?.removed.map((column) => (
          <li
            key={column.id}
            className="grid grid-cols-[31%_31%_38%] items-center border-t border-flap-seam font-mono text-[11px] text-removed"
            style={{ height: TABLE_ROW_HEIGHT }}
            aria-label={`Columna eliminada: ${column.name}`}
          >
            <span className="truncate px-[5px] line-through">
              {column.name}
            </span>
            <span className="truncate border-l border-flap-seam px-[5px] line-through">
              {column.type}
            </span>
            <span className="border-l border-flap-seam px-[5px] font-display text-[11px] font-semibold tracking-[0.08em] uppercase">
              Eliminada
            </span>
          </li>
        ))}
        {hidden > 0 && (
          <li
            className="flex items-center border-t border-flap-seam px-[5px] text-[11px] text-flap-muted"
            style={{ height: TABLE_ROW_HEIGHT }}
          >
            {hidden === 1 ? "1 columna más" : `${hidden} columnas más`}
          </li>
        )}
      </ul>
    </div>
  );
});
