import { Panel, useReactFlow, useViewport } from "@xyflow/react";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { MAX_ZOOM, MIN_ZOOM } from "../../constants/canvas";
import { selectDiagram } from "../../hooks/EditorStore";
import { useEditorStore } from "../../hooks/useEditorStore";
import { CanvasLegend } from "./CanvasLegend";

const BUTTON =
  "grid h-7 min-w-7 cursor-pointer place-items-center rounded-[2px] px-2 hover:bg-canvas disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent aria-pressed:bg-frame aria-pressed:text-frame-ink";

/** How long a zoom or a fit takes. Nothing when the system asks for reduced motion. */
function motion(ms: number): number {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : ms;
}

const count = (n: number, one: string, many: string): string =>
  `${n} ${n === 1 ? one : many}`;

/** Zoom, "Ver todo", the legend and how much the diagram holds. */
export function CanvasControls() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const diagram = useEditorStore(selectDiagram);
  const [legend, setLegend] = useState(false);

  return (
    <>
      <Panel
        position="bottom-left"
        className="flex items-center gap-px rounded-control border border-line bg-raised p-0.5 text-[12.5px] shadow-float"
      >
        <button
          type="button"
          className={BUTTON}
          aria-label="Alejar"
          title="Alejar"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => zoomOut({ duration: motion(150) })}
        >
          <Minus size={15} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          className={`${BUTTON} min-w-13 font-mono`}
          title="Volver a 100%"
          onClick={() => zoomTo(1, { duration: motion(150) })}
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className={BUTTON}
          aria-label="Acercar"
          title="Acercar"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => zoomIn({ duration: motion(150) })}
        >
          <Plus size={15} strokeWidth={1.75} aria-hidden />
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={() => fitView({ padding: 0.15, duration: motion(200) })}
        >
          Ver todo
        </button>
        <button
          type="button"
          className={BUTTON}
          aria-pressed={legend}
          onClick={() => setLegend((open) => !open)}
        >
          Leyenda
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <span className="px-2 text-ink-muted">
          {count(diagram.tables.length, "tabla", "tablas")} ·{" "}
          {count(diagram.relations.length, "relación", "relaciones")}
        </span>
      </Panel>
      {legend && <CanvasLegend />}
    </>
  );
}
