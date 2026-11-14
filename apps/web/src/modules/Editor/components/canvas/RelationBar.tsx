import type { RefAction } from "@design-db/core";
import { Panel } from "@xyflow/react";
import { X } from "lucide-react";
import { REF_ACTIONS } from "../../constants/relations";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";

const CONTROL =
  "h-7 cursor-pointer rounded-[2px] border border-line bg-raised px-2 hover:border-ink-muted";

/** What can be done with the selected relation: what happens on delete and on update, and removing it. */
export function RelationBar() {
  const diagram = useEditorStore(selectDiagram);
  const relationId = useEditorStore((state) => state.view.selectedRelationId);
  const relation = diagram.relations.find((r) => r.id === relationId);
  if (!relation) return null;

  const end = (tableId: string, columnIds: readonly string[]) => {
    const table = diagram.tables.find((t) => t.id === tableId);
    const columns = columnIds.map(
      (id) => table?.columns.find((c) => c.id === id)?.name ?? "?",
    );
    return `${table?.name ?? "?"}.${columns.join(", ")}`;
  };
  const label = `${end(relation.from.tableId, relation.from.columnIds)} → ${end(relation.to.tableId, relation.to.columnIds)}`;

  const { dispatch, notify, setView } = editorStore.getState();
  const change = (field: "onDelete" | "onUpdate", value: string) =>
    dispatch({
      type: "relation.update",
      relationId: relation.id,
      patch: { [field]: value as RefAction },
    });

  const remove = () => {
    dispatch({ type: "relation.remove", relationId: relation.id });
    notify(`Quitaste la relación ${label}.`);
  };

  return (
    <Panel
      position="top-center"
      className="flex max-w-[calc(100%-24px)] items-center gap-2 rounded-control border border-line bg-raised py-1 pr-1 pl-3 text-[13px] whitespace-nowrap shadow-float"
    >
      <b className="mr-1 truncate font-mono text-[12px] font-semibold">
        {label}
      </b>
      {(
        [
          ["onDelete", "Al eliminar"],
          ["onUpdate", "Al actualizar"],
        ] as const
      ).map(([field, text]) => (
        <label key={field} className="flex items-center gap-1.5">
          <span className="text-ink-muted">{text}</span>
          <select
            className={CONTROL}
            value={relation[field]}
            onChange={(event) => change(field, event.target.value)}
          >
            {REF_ACTIONS.map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button
        type="button"
        className={`${CONTROL} text-removed`}
        onClick={remove}
      >
        Quitar relación
      </button>
      <button
        type="button"
        className="grid size-7 cursor-pointer place-items-center rounded-[2px] text-ink-muted hover:bg-canvas hover:text-ink"
        aria-label="Quitar la selección"
        title="Quitar la selección"
        onClick={() => setView({ selectedRelationId: null })}
      >
        <X size={15} strokeWidth={1.75} aria-hidden />
      </button>
    </Panel>
  );
}
