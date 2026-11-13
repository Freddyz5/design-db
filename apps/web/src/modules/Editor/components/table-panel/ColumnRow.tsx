import type {
  Column,
  ColumnPatch,
  Diagram,
  Issue,
  RefAction,
  Table,
} from "@design-db/core";
import { Ellipsis } from "lucide-react";
import type { KeyboardEvent } from "react";
import { REF_ACTIONS } from "../../constants/relations";
import { editorStore } from "../../hooks/useEditorStore";
import { columnRelation, setColumnReference } from "../../utils/tableEdits";
import { BUTTON, CHECKBOX, Field, INPUT, IssueList } from "./Field";

/** The columns of the grid: name, type, PK, NN, UQ and the button for more. */
export const COLUMN_GRID =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_24px_24px_24px_28px] items-center gap-1 px-1.5";

const SERIAL = /^(small|big)?serial$/i;

type Props = {
  diagram: Diagram;
  table: Table;
  column: Column;
  index: number;
  expanded: boolean;
  /** Focus this row when it appears: its name, or its reference when it was added as a relation. */
  focus: "name" | "reference" | null;
  issues: readonly Issue[] | undefined;
  typeListId: string;
  onToggle: () => void;
  /** Enter in the name or the type: go to the same field of the next row. */
  onEnter: (field: "name" | "type", index: number) => void;
};

/** One column in the edit panel: its row, and its details when expanded. */
export function ColumnRow({
  diagram,
  table,
  column,
  index,
  expanded,
  focus,
  issues,
  typeListId,
  onToggle,
  onEnter,
}: Props) {
  const { dispatch, replace, checkpoint, notify } = editorStore.getState();
  const relation = columnRelation(diagram, table.id, column.id);
  const composite =
    relation !== undefined && relation.from.columnIds.length > 1;
  const parent = diagram.tables.find((t) => t.id === relation?.to.tableId);

  const update = (patch: ColumnPatch, field?: string) =>
    dispatch(
      { type: "column.update", tableId: table.id, columnId: column.id, patch },
      field ? { mergeKey: `column.${field}:${column.id}` } : undefined,
    );

  const enter = (field: "name" | "type") => (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    onEnter(field, index);
  };

  const move = (to: number) =>
    dispatch({
      type: "column.move",
      tableId: table.id,
      columnId: column.id,
      index: to,
    });

  const remove = () => {
    dispatch({ type: "column.remove", tableId: table.id, columnId: column.id });
    notify(`Quitaste la columna ${column.name}.`);
  };

  return (
    <li
      className={`border-t border-line py-1 ${column.primaryKey ? "bg-key/45" : ""}`}
    >
      <div className={COLUMN_GRID}>
        <input
          className={`${INPUT} !h-7 !px-1.5 font-mono !text-[12px]`}
          data-field="name"
          aria-label="Nombre de la columna"
          aria-invalid={issues?.some((issue) =>
            issue.code.endsWith("-column-name"),
          )}
          value={column.name}
          spellCheck={false}
          autoComplete="off"
          autoFocus={focus === "name"}
          onFocus={
            focus === "name" ? (event) => event.target.select() : undefined
          }
          onChange={(event) => update({ name: event.target.value }, "name")}
          onBlur={checkpoint}
          onKeyDown={enter("name")}
        />
        <input
          className={`${INPUT} !h-7 !px-1.5 font-mono !text-[12px]`}
          data-field="type"
          aria-label="Tipo de dato"
          value={column.type}
          list={typeListId}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) =>
            update(
              SERIAL.test(event.target.value.trim())
                ? { type: event.target.value, autoIncrement: true }
                : { type: event.target.value },
              "type",
            )
          }
          onBlur={() => {
            if (column.type.trim() === "") update({ type: "text" });
            checkpoint();
          }}
          onKeyDown={enter("type")}
        />
        <input
          type="checkbox"
          className={`${CHECKBOX} justify-self-center`}
          aria-label="Clave primaria"
          title="Clave primaria"
          checked={column.primaryKey}
          onChange={(event) =>
            update(
              event.target.checked
                ? { primaryKey: true, nullable: false }
                : { primaryKey: false },
            )
          }
        />
        <input
          type="checkbox"
          className={`${CHECKBOX} justify-self-center`}
          aria-label="Obligatoria"
          title="Obligatoria (NOT NULL)"
          checked={!column.nullable}
          disabled={column.primaryKey && !column.nullable}
          onChange={(event) => update({ nullable: !event.target.checked })}
        />
        <input
          type="checkbox"
          className={`${CHECKBOX} justify-self-center`}
          aria-label="Única"
          title="Única"
          checked={column.unique}
          onChange={(event) => update({ unique: event.target.checked })}
        />
        <button
          type="button"
          className="relative grid size-7 cursor-pointer place-items-center rounded-[2px] text-ink-muted hover:bg-canvas hover:text-ink aria-expanded:bg-canvas aria-expanded:text-ink"
          aria-expanded={expanded}
          aria-label="Más opciones de la columna"
          title="Relación, valor por defecto y nota"
          onClick={onToggle}
        >
          <Ellipsis size={16} strokeWidth={1.75} aria-hidden />
          {relation && (
            <span className="absolute top-1 right-1 size-1.5 rounded-full bg-relation" />
          )}
        </button>
      </div>

      {issues && issues.length > 0 && (
        <div className="px-2 pt-1">
          <IssueList issues={issues} />
        </div>
      )}

      {expanded && (
        <div className="flex flex-col gap-2 px-2 pt-2 pb-1.5">
          {composite ? (
            <p className="text-[12.5px] text-ink-muted">
              Esta columna es parte de una relación de varias columnas.
            </p>
          ) : (
            <div className="flex gap-2">
              <Field label="Referencia (FK)">
                <select
                  className={INPUT}
                  value={relation?.to.tableId ?? ""}
                  autoFocus={focus === "reference"}
                  onChange={(event) =>
                    replace(
                      setColumnReference(
                        diagram,
                        table.id,
                        column.id,
                        event.target.value
                          ? { tableId: event.target.value }
                          : undefined,
                      ),
                    )
                  }
                >
                  <option value="">Sin relación</option>
                  {[...diagram.tables]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((other) => (
                      <option key={other.id} value={other.id}>
                        {other.name}
                      </option>
                    ))}
                </select>
              </Field>
              {relation && parent && (
                <Field label="Columna">
                  <select
                    className={INPUT}
                    value={relation.to.columnIds[0]}
                    onChange={(event) =>
                      replace(
                        setColumnReference(diagram, table.id, column.id, {
                          tableId: parent.id,
                          columnId: event.target.value,
                        }),
                      )
                    }
                  >
                    {parent.columns.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>
          )}
          {relation && (
            <Field label="Al eliminar la fila referida">
              <select
                className={INPUT}
                value={relation.onDelete}
                onChange={(event) =>
                  dispatch({
                    type: "relation.update",
                    relationId: relation.id,
                    patch: { onDelete: event.target.value as RefAction },
                  })
                }
              >
                {REF_ACTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex items-end gap-2">
            <Field label="Valor por defecto">
              <input
                className={`${INPUT} font-mono !text-[12px]`}
                value={column.default ?? ""}
                placeholder="now(), 0, 'Quito'"
                spellCheck={false}
                autoComplete="off"
                onChange={(event) =>
                  update(
                    { default: event.target.value || undefined },
                    "default",
                  )
                }
                onBlur={checkpoint}
              />
            </Field>
            <label className="flex h-[30px] flex-none cursor-pointer items-center gap-1.5 text-[13px]">
              <input
                type="checkbox"
                className={CHECKBOX}
                checked={column.autoIncrement}
                onChange={(event) =>
                  update({ autoIncrement: event.target.checked })
                }
              />
              Autoincremental
            </label>
          </div>
          <Field label="Nota">
            <input
              className={INPUT}
              value={column.comment ?? ""}
              onChange={(event) =>
                update({ comment: event.target.value || undefined }, "comment")
              }
              onBlur={checkpoint}
            />
          </Field>
          <div className="flex gap-2">
            <button
              type="button"
              className={BUTTON}
              disabled={index === 0}
              onClick={() => move(index - 1)}
            >
              Subir
            </button>
            <button
              type="button"
              className={BUTTON}
              disabled={index === table.columns.length - 1}
              onClick={() => move(index + 1)}
            >
              Bajar
            </button>
            <span className="flex-1" />
            <button
              type="button"
              className={`${BUTTON} text-removed`}
              onClick={remove}
            >
              Quitar columna
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
