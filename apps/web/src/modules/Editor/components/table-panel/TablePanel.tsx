import {
  createColumn,
  suggestedColumnTypes,
  validate,
  type Diagram,
  type Id,
  type Table,
} from "@design-db/core";
import { Panel } from "@xyflow/react";
import { X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { removeTables } from "../../utils/diagramEdits";
import {
  addGroupWith,
  nextColumnName,
  tableIssues,
} from "../../utils/tableEdits";
import { COLUMN_GRID, ColumnRow } from "./ColumnRow";
import { BUTTON, Field, INPUT, IssueList } from "./Field";

const NEW_GROUP = "__new";

/** The panel to edit a table: its name, group, note and columns. Opens with a double click on the table. */
export function TablePanel() {
  const diagram = useEditorStore(selectDiagram);
  const tableId = useEditorStore((state) => state.view.editingTableId);
  const table = diagram.tables.find((t) => t.id === tableId);
  if (!table) return null;
  // The key starts the panel over (focus, expanded rows) for another table.
  return <TablePanelBody key={table.id} diagram={diagram} table={table} />;
}

function TablePanelBody({
  diagram,
  table,
}: {
  diagram: Diagram;
  table: Table;
}) {
  const { dispatch, replace, checkpoint, notify, setView } =
    editorStore.getState();
  const typeListId = useId();
  const body = useRef<HTMLDivElement>(null);
  const name = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<Id>>(new Set());
  /** The column that was just added, and what to focus in it. */
  const [added, setAdded] = useState<{
    id: Id;
    focus: "name" | "reference";
  } | null>(null);

  const issues = useMemo(
    () => tableIssues(diagram, validate(diagram), table.id),
    [diagram, table.id],
  );
  const types = useMemo(
    () => [
      ...suggestedColumnTypes(diagram.dialect),
      ...diagram.enums.map((item) => item.name),
    ],
    [diagram.dialect, diagram.enums],
  );

  useEffect(() => {
    name.current?.focus();
    name.current?.select();
  }, []);

  const close = () => setView({ editingTableId: null });

  const toggle = (columnId: Id) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(columnId)) next.add(columnId);
      return next;
    });

  const addColumn = (kind: "name" | "reference") => {
    const integer = types.includes("integer") ? "integer" : "int";
    const text = types.includes("varchar(255)") ? "varchar(255)" : "text";
    const column = createColumn(
      kind === "reference"
        ? { name: nextColumnName(table, "ref"), type: integer }
        : { name: nextColumnName(table, "columna"), type: text },
    );
    dispatch({ type: "column.add", tableId: table.id, column });
    if (kind === "reference") toggle(column.id);
    setAdded({ id: column.id, focus: kind });
  };

  /** Enter in a row goes to the same field of the next row, or adds a column after the last one. */
  const onEnter = (field: "name" | "type", index: number) => {
    const inputs = body.current?.querySelectorAll<HTMLInputElement>(
      `input[data-field="${field}"]`,
    );
    const next = inputs?.[index + 1];
    if (next) next.focus();
    else addColumn("name");
  };

  const changeGroup = (value: string) => {
    if (value === NEW_GROUP) {
      replace(addGroupWith(diagram, [table.id]).diagram);
    } else {
      dispatch({
        type: "table.update",
        tableId: table.id,
        patch: { groupId: value || undefined },
      });
    }
  };

  const removeTable = () => {
    replace(removeTables(diagram, [table.id]));
    notify(`Eliminaste la tabla ${table.name}.`);
  };

  const groupExists = diagram.groups.some((g) => g.id === table.groupId);

  return (
    <Panel
      position="top-right"
      className="nowheel nopan flex w-[400px] max-w-[calc(100%-30px)] flex-col rounded-control border border-line bg-panel text-ink shadow-float"
      style={{ maxHeight: "calc(100% - 30px)" }}
    >
      <section
        aria-label={`Editar la tabla ${table.name}`}
        className="flex min-h-0 flex-1 flex-col"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            close();
          }
        }}
      >
        <header className="flex items-center gap-2 border-b border-line py-1.5 pr-1.5 pl-3.5">
          <span className="font-display text-[12px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
            Editar tabla
          </span>
          <b className="min-w-0 truncate font-mono text-[13px] font-semibold">
            {table.name}
          </b>
          <span className="flex-1" />
          <button
            type="button"
            className="grid size-7 flex-none cursor-pointer place-items-center rounded-[2px] text-ink-muted hover:bg-canvas hover:text-ink"
            aria-label="Cerrar el panel"
            title="Cerrar (Esc)"
            onClick={close}
          >
            <X size={15} strokeWidth={1.75} aria-hidden />
          </button>
        </header>

        <div
          ref={body}
          className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-3"
        >
          <Field label="Nombre" issues={issues.name}>
            <input
              ref={name}
              className={`${INPUT} font-mono font-semibold`}
              aria-invalid={issues.name.length > 0}
              value={table.name}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) =>
                dispatch(
                  {
                    type: "table.update",
                    tableId: table.id,
                    patch: { name: event.target.value },
                  },
                  { mergeKey: `table.name:${table.id}` },
                )
              }
              onBlur={checkpoint}
            />
          </Field>

          <Field label="Grupo" issues={issues.group}>
            <select
              className={INPUT}
              value={table.groupId ?? ""}
              onChange={(event) => changeGroup(event.target.value)}
            >
              <option value="">Sin grupo</option>
              {table.groupId !== undefined && !groupExists && (
                <option value={table.groupId}>Grupo que ya no existe</option>
              )}
              {diagram.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
              <option value={NEW_GROUP}>Nuevo grupo…</option>
            </select>
          </Field>

          <Field label="Nota">
            <textarea
              className={`${INPUT} !h-auto resize-y py-1.5 leading-snug`}
              rows={2}
              placeholder="Para qué sirve esta tabla"
              value={table.comment ?? ""}
              onChange={(event) =>
                dispatch(
                  {
                    type: "table.update",
                    tableId: table.id,
                    patch: { comment: event.target.value || undefined },
                  },
                  { mergeKey: `table.comment:${table.id}` },
                )
              }
              onBlur={checkpoint}
            />
          </Field>

          <div className="flex flex-col gap-1.5">
            <div className="overflow-hidden rounded-control border border-line bg-panel">
              <div
                className={`${COLUMN_GRID} h-7 bg-canvas font-display text-[11.5px] font-semibold tracking-[0.08em] text-ink-muted uppercase`}
              >
                <span>Columna</span>
                <span>Tipo</span>
                <span className="text-center" title="Clave primaria">
                  PK
                </span>
                <span className="text-center" title="Obligatoria (NOT NULL)">
                  NN
                </span>
                <span className="text-center" title="Única">
                  UQ
                </span>
                <span />
              </div>
              <ul>
                {table.columns.map((column, index) => (
                  <ColumnRow
                    key={column.id}
                    diagram={diagram}
                    table={table}
                    column={column}
                    index={index}
                    expanded={expanded.has(column.id)}
                    focus={added?.id === column.id ? added.focus : null}
                    issues={issues.columns[column.id]}
                    typeListId={typeListId}
                    onToggle={() => toggle(column.id)}
                    onEnter={onEnter}
                  />
                ))}
              </ul>
            </div>
            <IssueList issues={issues.table} />
            <div className="flex gap-2">
              <button
                type="button"
                className={BUTTON}
                onClick={() => addColumn("name")}
              >
                + Columna
              </button>
              <button
                type="button"
                className={BUTTON}
                title="Agrega una columna que referencia a otra tabla"
                onClick={() => addColumn("reference")}
              >
                + Relación
              </button>
            </div>
          </div>

          <datalist id={typeListId}>
            {types.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </div>

        <footer className="flex items-center border-t border-line px-3.5 py-2">
          <button
            type="button"
            className={`${BUTTON} text-removed`}
            onClick={removeTable}
          >
            Eliminar tabla
          </button>
        </footer>
      </section>
    </Panel>
  );
}
