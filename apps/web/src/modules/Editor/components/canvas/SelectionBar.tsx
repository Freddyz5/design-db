import { Panel } from "@xyflow/react";
import { X } from "lucide-react";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { removeTables, setTablesGroup } from "../../utils/diagramEdits";

const BUTTON =
  "h-7 cursor-pointer rounded-[2px] border border-line bg-raised px-2.5 hover:border-ink-muted";

/** What can be done with the selected tables. Shown only while there is a selection. */
export function SelectionBar() {
  const diagram = useEditorStore(selectDiagram);
  const selection = useEditorStore((state) => state.view.selection);
  const editing = useEditorStore((state) => state.view.editingTableId);

  const tables = diagram.tables.filter((table) => selection.includes(table.id));
  // While a table is being edited, its panel has these actions.
  if (tables.length === 0 || editing !== null) return null;
  const [first] = tables;
  const only = tables.length === 1 ? first : undefined;
  const ids = tables.map((table) => table.id);

  const moveToGroup = (groupId: string | undefined) =>
    editorStore.getState().replace(setTablesGroup(diagram, ids, groupId));

  const remove = () => {
    const { replace, notify } = editorStore.getState();
    replace(removeTables(diagram, ids));
    notify(
      only
        ? `Eliminaste la tabla ${only.name}.`
        : `Eliminaste ${tables.length} tablas.`,
    );
  };

  return (
    <Panel
      position="top-center"
      className="flex max-w-[calc(100%-24px)] items-center gap-1.5 rounded-control border border-line bg-raised py-1 pr-1 pl-3 text-[13px] whitespace-nowrap shadow-float"
    >
      <span className="mr-1">
        {only ? (
          <b className="font-mono font-semibold">{only.name}</b>
        ) : (
          <>
            <b className="font-semibold">{tables.length}</b> tablas
          </>
        )}
      </span>
      {diagram.groups.length > 0 && (
        <select
          className={`${BUTTON} max-w-44`}
          aria-label="Mover a un grupo"
          value=""
          onChange={(event) => {
            if (event.target.value) moveToGroup(event.target.value);
          }}
        >
          <option value="">Mover a grupo…</option>
          {diagram.groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      )}
      {tables.some((table) => table.groupId !== undefined) && (
        <button
          type="button"
          className={BUTTON}
          onClick={() => moveToGroup(undefined)}
        >
          Quitar del grupo
        </button>
      )}
      {only && (
        <button
          type="button"
          className={BUTTON}
          onClick={() =>
            editorStore.getState().setView({ editingTableId: only.id })
          }
        >
          Editar
        </button>
      )}
      <button
        type="button"
        className={`${BUTTON} text-removed`}
        onClick={remove}
      >
        Eliminar
      </button>
      <button
        type="button"
        className="grid size-7 cursor-pointer place-items-center rounded-[2px] text-ink-muted hover:bg-canvas hover:text-ink"
        aria-label="Quitar la selección"
        title="Quitar la selección"
        onClick={() => editorStore.getState().setView({ selection: [] })}
      >
        <X size={15} strokeWidth={1.75} aria-hidden />
      </button>
    </Panel>
  );
}
