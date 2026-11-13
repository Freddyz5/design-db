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
  type TableNode,
} from "../../utils/canvasElements";

/** Where relations attach. Invisible: one point on each side of the row. */
const ANCHOR =
  "!h-px !min-h-0 !w-px !min-w-0 !border-0 !bg-transparent !opacity-0";

/** The point to drag a relation from. It shows when the pointer is over the table. */
const DRAG_POINT =
  "!size-[11px] !border-[1.5px] !border-lamp-ink !bg-raised opacity-0 transition-opacity duration-100 group-hover:opacity-100 hover:!bg-lamp [.linking_&]:opacity-100";

function ColumnRow({
  column,
  reference,
}: {
  column: Column;
  reference: string | undefined;
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
      <span className="truncate px-[5px]" title={column.name}>
        {column.name}
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
  const { table, strip, references } = data;

  return (
    <div
      className={`group border-[1.5px] border-flap-edge bg-flap text-flap-ink shadow-float ${selected ? "outline-[3px] outline-lamp" : ""}`}
      style={{ width: TABLE_WIDTH }}
      data-table-id={table.id}
    >
      <div
        className="flex items-center justify-between gap-2 px-2 font-display text-[15.5px] font-bold tracking-[0.06em]"
        style={{
          height: TABLE_HEADER_HEIGHT,
          backgroundColor: strip.background,
          color: strip.ink,
        }}
      >
        <span className="truncate" title={table.name}>
          {table.name}
        </span>
        <span
          className="font-mono text-[11px] font-medium opacity-80"
          title={`${table.columns.length} columnas`}
        >
          {table.columns.length}
        </span>
      </div>
      <ul>
        {table.columns.map((column) => (
          <ColumnRow
            key={column.id}
            column={column}
            reference={references[column.id]}
          />
        ))}
      </ul>
    </div>
  );
});
