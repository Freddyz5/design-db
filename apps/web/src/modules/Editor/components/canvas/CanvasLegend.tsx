import { Panel } from "@xyflow/react";
import { shortcutList } from "../../utils/shortcuts";
import { manyMark, oneMark } from "./RelationEdge";

const LINE = "fill-none stroke-relation";

function Sample({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 44 14"
      className="h-3.5 w-11 flex-none overflow-visible"
      aria-hidden
    >
      <path d="M0,7 H44" className={LINE} strokeWidth={1.4} />
      {children}
    </svg>
  );
}

const COMMAND =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent)
    ? "⌘"
    : "Ctrl";

/** The help: what the marks on the canvas mean, and the keyboard shortcuts. */
export function CanvasLegend() {
  return (
    <Panel
      position="bottom-right"
      className="nowheel !mb-7 flex max-h-[calc(100%-80px)] w-[300px] flex-col gap-3 overflow-y-auto rounded-control border border-line bg-raised px-3 py-2.5 text-[12.5px] shadow-float"
    >
      <h2 className="font-display text-[12px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
        Leyenda
      </h2>
      <ul className="flex flex-col gap-2" aria-label="Leyenda">
        <li className="flex items-center gap-2.5">
          <Sample>
            <path
              d={`${manyMark(0, 7, 1)} ${oneMark(44, 7, -1)}`}
              className={LINE}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </Sample>
          muchos a uno
        </li>
        <li className="flex items-center gap-2.5">
          <Sample>
            <path
              d={`${oneMark(0, 7, 1)} ${oneMark(44, 7, -1)}`}
              className={LINE}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          </Sample>
          uno a uno
        </li>
        <li className="flex items-center gap-2.5">
          <Sample>
            <path
              d={`${manyMark(0, 7, 1)} ${oneMark(44, 7, -1)}`}
              className={LINE}
              strokeWidth={1.4}
              strokeLinecap="round"
            />
            <circle
              cx={18}
              cy={7}
              r={3.5}
              className="fill-raised stroke-relation"
              strokeWidth={1.4}
            />
          </Sample>
          la relación es opcional
        </li>
        <li className="flex items-center gap-2.5">
          <svg viewBox="0 0 44 14" className="h-3.5 w-11 flex-none" aria-hidden>
            <path
              d="M0,7 H44"
              className={LINE}
              strokeWidth={1.4}
              strokeDasharray="5 4"
            />
          </svg>
          va a otro grupo
        </li>
        <li className="flex items-center gap-2.5">
          <span className="h-3.5 w-11 flex-none border border-flap-edge bg-key" />
          clave primaria
        </li>
      </ul>
      <h2 className="font-display text-[12px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
        Atajos
      </h2>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
        {shortcutList(COMMAND).map(({ keys, what }) => (
          <div key={what} className="contents">
            <dt className="flex gap-1">
              {keys.map((key) => (
                <kbd
                  key={key}
                  className="rounded-[2px] border border-line bg-canvas px-1.5 font-mono text-[11px] leading-5"
                >
                  {key}
                </kbd>
              ))}
            </dt>
            <dd>{what}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[12px] text-ink-muted">
        Doble clic en una tabla para editarla. Arrastra el punto al borde de una
        columna hasta otra tabla para relacionarlas. Shift + arrastrar
        selecciona varias tablas; Ctrl + rueda o pellizcar hace zoom.
      </p>
    </Panel>
  );
}
