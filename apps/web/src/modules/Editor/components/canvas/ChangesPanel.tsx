import { Panel, useReactFlow } from "@xyflow/react";
import { X } from "lucide-react";
import { useMemo } from "react";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import {
  changeWord,
  describeChanges,
  type ChangeLine,
} from "../../utils/diagramChanges";

const KIND_STYLE: Record<ChangeLine["kind"], string> = {
  added: "bg-added",
  modified: "bg-changed",
  removed: "bg-removed",
};

const fitDuration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250;

/** The list of what changed since the base. Picking a change shows its table. */
export function ChangesPanel() {
  const diagram = useEditorStore(selectDiagram);
  const open = useEditorStore((state) => state.view.showChanges);
  const { fitView } = useReactFlow();
  const lines = useMemo(() => describeChanges(diagram), [diagram]);
  if (!open || !diagram.base) return null;

  const show = (tableId: string) => {
    editorStore.getState().setView({ selection: [tableId] });
    void fitView({
      nodes: [{ id: tableId }],
      padding: 0.6,
      maxZoom: 1,
      duration: fitDuration(),
    });
  };

  return (
    <Panel
      position="top-left"
      className="nowheel nopan !mt-16 flex max-h-[calc(100%-140px)] w-[300px] flex-col rounded-control border border-line bg-panel shadow-float"
    >
      <header className="flex items-center gap-2 border-b border-line py-1.5 pr-1.5 pl-3">
        <h2 className="font-display text-[13px] font-semibold tracking-[0.08em] uppercase">
          Cambios
        </h2>
        <span className="text-[12px] text-ink-muted">{lines.length}</span>
        <span className="flex-1" />
        <button
          type="button"
          className="grid size-7 cursor-pointer place-items-center rounded-[2px] text-ink-muted hover:bg-canvas hover:text-ink"
          aria-label="Ocultar los cambios"
          title="Ocultar los cambios"
          onClick={() => editorStore.getState().setView({ showChanges: false })}
        >
          <X size={15} strokeWidth={1.75} aria-hidden />
        </button>
      </header>
      {lines.length === 0 ? (
        <p className="px-3 py-3 text-[13px] text-ink-muted">
          No hay cambios desde que fijaste la base.
        </p>
      ) : (
        <ul className="min-h-0 overflow-y-auto py-1">
          {lines.map((line, index) => {
            const body = (
              <>
                <span
                  className={`mt-1.5 size-1.5 flex-none ${KIND_STYLE[line.kind]}`}
                  aria-hidden
                />
                <span className="min-w-0">
                  <span className="block truncate font-mono text-[12px]">
                    {line.subject}
                  </span>
                  <span className="block text-[11.5px] text-ink-muted">
                    {changeWord(line.kind)}
                    {line.detail ? `: ${line.detail}` : ""}
                  </span>
                </span>
              </>
            );
            const row = "flex w-full gap-2 px-3 py-1.5 text-left";
            return (
              <li key={`${line.subject}-${index}`}>
                {line.tableId ? (
                  <button
                    type="button"
                    className={`${row} cursor-pointer hover:bg-canvas`}
                    onClick={() => show(line.tableId!)}
                  >
                    {body}
                  </button>
                ) : (
                  <div className={row}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
