import type { Column } from "@design-db/core";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { memo } from "react";
import { FlapText } from "../../../shared";
import {
  TABLE_HEADER_HEIGHT,
  TABLE_NOTE_GAP,
  TABLE_ROW_HEIGHT,
  TABLE_WIDTH,
} from "../../constants/canvas";
import {
  dragHandleId,
  handleId,
  stripHandleId,
  type TableNode,
} from "../../utils/canvasElements";
import type { ColumnFace } from "../../utils/tableCard";

/** Where relations attach. Invisible: one point on each side of the row. */
const ANCHOR =
  "!h-px !min-h-0 !w-px !min-w-0 !border-0 !bg-transparent !opacity-0";

/** The point to drag a relation from. It shows when the pointer is over the table. */
const DRAG_POINT =
  "!size-[11px] !border-[1.5px] !border-accent-ink !bg-raised opacity-0 transition-opacity duration-100 group-hover:opacity-100 hover:!bg-accent [.linking_&]:opacity-100";

/** The mark of a changed column: a small square before its name. */
const CHANGE_LAMP: Record<
  "added" | "modified",
  { className: string; label: string }
> = {
  added: { className: "bg-added", label: "Columna nueva" },
  modified: { className: "bg-changed", label: "Columna que cambió" },
};

/** The three cells of a row: name, type and constraints. */
const ROW_GRID = "grid grid-cols-[28%_27%_45%] items-center";

function ColumnRow({
  column,
  face,
  change,
}: {
  column: Column;
  face: ColumnFace | undefined;
  change?: "added" | "modified";
}) {
  const reference = face?.reference ?? null;
  const rules = face?.rules ?? "";
  const enumValues = face?.enumValues ?? null;
  const pointsAt = reference ? `FK → ${reference.table}` : "";
  const detail = [
    rules,
    reference ? `FK → ${reference.table}.${reference.column}` : null,
  ]
    .filter((part) => part)
    .join(", ");

  return (
    <li
      className={`relative ${ROW_GRID} border-t border-sheet-rule font-mono text-[11px] ${column.primaryKey ? "bg-key" : ""}`}
      style={{ height: TABLE_ROW_HEIGHT }}
      data-column-id={column.id}
    >
      <span
        className="flex min-w-0 items-center gap-1 px-[5px]"
        title={
          column.comment ? `${column.name}: ${column.comment}` : column.name
        }
      >
        {change && (
          <span
            className={`size-1.5 flex-none ${CHANGE_LAMP[change].className}`}
            role="img"
            aria-label={CHANGE_LAMP[change].label}
          />
        )}
        <FlapText text={column.name} className="truncate" />
      </span>
      <span
        className="flex min-w-0 items-center self-stretch border-l border-sheet-rule px-[5px] text-sheet-muted"
        title={
          enumValues ? `${column.type}: ${enumValues.join(" · ")}` : column.type
        }
      >
        <FlapText
          text={column.type}
          className={`truncate ${enumValues ? "cursor-help border-b border-dotted border-current" : ""}`}
        />
      </span>
      <span
        className={`flex min-w-0 items-center gap-1 self-stretch border-l border-sheet-rule px-[5px] ${column.primaryKey ? "text-key-ink" : "text-sheet-muted"}`}
        title={detail}
      >
        <FlapText
          text={reference ? `${rules},` : rules}
          className={`min-w-0 shrink truncate ${column.primaryKey ? "font-semibold" : ""}`}
        />
        {/* Always mounted, empty without a reference, so a first relation flips too. */}
        <FlapText
          text={pointsAt}
          className="flex-none font-semibold text-sheet-ink empty:hidden"
        />
        {reference?.group != null && (
          <span
            className="flex-none rounded-[2px] bg-sheet-rule px-1 leading-4 text-sheet-muted"
            title={`Tabla del grupo ${reference.group}`}
          >
            {reference.group}
          </span>
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
  const {
    table,
    strip,
    columns,
    faces,
    header,
    note,
    hidden,
    focused,
    flashKey,
    dimmed,
    marks,
  } = data;
  const outline = selected
    ? "outline-[3px] outline-accent"
    : focused
      ? "outline-2 outline-offset-2 outline-accent-ink"
      : "";

  return (
    <figure
      className={`group m-0 transition-opacity duration-150 motion-reduce:transition-none ${dimmed ? "opacity-25" : ""}`}
      style={{ width: TABLE_WIDTH }}
      data-table-id={table.id}
    >
      <div
        className={`relative border-[1.5px] border-sheet-edge bg-sheet text-sheet-ink shadow-float ${outline}`}
      >
        <div
          className="relative flex items-center justify-between gap-2 px-2 font-display text-[15.5px] font-bold tracking-[0.06em]"
          style={{
            height: TABLE_HEADER_HEIGHT,
            backgroundColor: strip.background,
            color: strip.ink,
          }}
        >
          <FlapText text={table.name} title={table.name} className="truncate" />
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
          {header && (
            <li
              className={`${ROW_GRID} border-t border-sheet-rule font-display text-[11px] font-semibold tracking-[0.08em] text-sheet-muted uppercase`}
              style={{ height: TABLE_ROW_HEIGHT }}
              aria-hidden
            >
              <span className="truncate px-[5px]">Atributo</span>
              <span className="self-stretch truncate border-l border-sheet-rule px-[5px] leading-6">
                Tipo de dato
              </span>
              <span className="self-stretch truncate border-l border-sheet-rule px-[5px] leading-6">
                Restricción
              </span>
            </li>
          )}
          {columns.map((column) => (
            <ColumnRow
              key={column.id}
              column={column}
              face={faces[column.id]}
              {...(marks?.columns[column.id]
                ? { change: marks.columns[column.id] }
                : {})}
            />
          ))}
          {marks?.removed.map((column) => (
            <li
              key={column.id}
              className={`${ROW_GRID} border-t border-sheet-rule font-mono text-[11px] text-removed`}
              style={{ height: TABLE_ROW_HEIGHT }}
              aria-label={`Columna eliminada: ${column.name}`}
            >
              <span className="truncate px-[5px] line-through">
                {column.name}
              </span>
              <span className="truncate border-l border-sheet-rule px-[5px] line-through">
                {column.type}
              </span>
              <span className="border-l border-sheet-rule px-[5px] font-display text-[11px] font-semibold tracking-[0.08em] uppercase">
                Eliminada
              </span>
            </li>
          ))}
          {hidden > 0 && (
            <li
              className="flex items-center border-t border-sheet-rule px-[5px] text-[11px] text-sheet-muted"
              style={{ height: TABLE_ROW_HEIGHT }}
            >
              {hidden === 1 ? "1 columna más" : `${hidden} columnas más`}
            </li>
          )}
        </ul>
        {/* Keyed: a new flash mounts a new ring, so it plays again. */}
        {flashKey !== null && (
          <span key={flashKey} className="table-flash" aria-hidden />
        )}
      </div>
      {note && (
        <figcaption
          className="px-0.5 text-[12px] leading-4 break-words whitespace-pre-line text-ink-muted"
          style={{ marginTop: TABLE_NOTE_GAP }}
        >
          {note}
        </figcaption>
      )}
    </figure>
  );
});
