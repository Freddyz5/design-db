import { Panel } from "@xyflow/react";
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

/** What the marks on the canvas mean. */
export function CanvasLegend() {
  return (
    <Panel
      position="bottom-right"
      className="!mb-7 rounded-control border border-line bg-raised px-3 py-2.5 text-[12.5px] shadow-float"
    >
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
          <span className="h-3.5 w-11 flex-none border border-flap-edge bg-key" />
          clave primaria
        </li>
      </ul>
    </Panel>
  );
}
