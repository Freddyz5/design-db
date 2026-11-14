import { Panel, useViewport } from "@xyflow/react";
import { PanelBottomOpen, X } from "lucide-react";
import { useEffect } from "react";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { titleBlockPref } from "../../services/titleBlockPref";
import { drawingScale } from "../../utils/drawingScale";
import { savedAt } from "../../utils/savedAt";

const LABEL =
  "border-r border-sheet-rule px-2 py-[3px] font-display text-[10px] font-semibold tracking-[0.12em] text-sheet-muted uppercase";
const CELL = "min-w-0 truncate px-2 py-[3px]";
const VALUE = `${CELL} font-mono text-[11px]`;

const count = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;

function setOpen(open: boolean): void {
  titleBlockPref.set(open);
  editorStore.getState().setView({ titleBlockOpen: open });
}

/**
 * The title block in the corner of the plan: what the drawing is, its scale
 * (the zoom), how much it holds and when it was saved. It can be hidden;
 * the choice is remembered. It steps aside while the legend is open.
 */
export function TitleBlock() {
  const open = useEditorStore((state) => state.view.titleBlockOpen);
  const help = useEditorStore((state) => state.view.helpOpen);
  const name = useEditorStore((state) => selectDiagram(state).name);
  const tables = useEditorStore((state) => selectDiagram(state).tables.length);
  const relations = useEditorStore(
    (state) => selectDiagram(state).relations.length,
  );
  const saved = useEditorStore((state) => state.view.savedAt);
  const { zoom } = useViewport();

  useEffect(() => {
    if (!titleBlockPref.get())
      editorStore.getState().setView({ titleBlockOpen: false });
  }, []);

  if (help) return null;

  if (!open) {
    return (
      <Panel position="bottom-right">
        <button
          type="button"
          className="flex h-8 cursor-pointer items-center gap-1.5 rounded-control border border-line bg-raised px-2.5 font-display text-[11px] font-semibold tracking-[0.12em] text-ink-muted uppercase shadow-float hover:text-ink"
          title="Mostrar el cajetín"
          onClick={() => setOpen(true)}
        >
          <PanelBottomOpen size={14} strokeWidth={1.75} aria-hidden />
          Cajetín
        </button>
      </Panel>
    );
  }

  return (
    <Panel position="bottom-right">
      <section
        aria-label="Cajetín"
        className="group/block relative grid w-64 max-[720px]:hidden grid-cols-[auto_minmax(0,1fr)] border-[1.5px] border-sheet-edge bg-sheet text-sheet-ink"
      >
        <span className={`${LABEL} border-b`}>Plano</span>
        <span
          className={`${CELL} border-b border-sheet-rule font-display text-[12.5px] font-bold tracking-[0.04em]`}
          title={name}
        >
          {name}
        </span>
        <span className={`${LABEL} border-b`}>Escala</span>
        <span className={`${VALUE} border-b border-sheet-rule`}>
          {drawingScale(zoom)} · {Math.round(zoom * 100)}%
        </span>
        <span className={`${LABEL} border-b`}>Contenido</span>
        <span className={`${VALUE} border-b border-sheet-rule`}>
          {count(tables, "tabla", "tablas")} ·{" "}
          {count(relations, "relación", "relaciones")}
        </span>
        <span className={LABEL}>Guardado</span>
        <span className={VALUE}>{saved ? savedAt(saved) : "Sin guardar"}</span>
        <button
          type="button"
          className="absolute -top-px -right-px grid size-6 cursor-pointer place-items-center bg-sheet text-sheet-muted opacity-0 group-hover/block:opacity-100 hover:text-sheet-ink focus-visible:opacity-100"
          aria-label="Ocultar el cajetín"
          title="Ocultar el cajetín"
          onClick={() => setOpen(false)}
        >
          <X size={13} strokeWidth={1.75} aria-hidden />
        </button>
      </section>
    </Panel>
  );
}
