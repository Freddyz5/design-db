import { createExampleDiagram } from "@design-db/core";
import { Panel } from "@xyflow/react";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { selectDiagram } from "../../hooks/EditorStore";

const BUTTON =
  "inline-flex h-[30px] cursor-pointer items-center rounded-control border px-3 text-[13px] whitespace-nowrap border-line bg-raised hover:border-ink-muted";

/** The one primary action: amber. */
const PRIMARY =
  "inline-flex h-[30px] cursor-pointer items-center rounded-control border px-3 text-[13px] whitespace-nowrap border-lamp bg-lamp font-semibold text-on-lamp hover:brightness-105";

/** What the canvas shows while the diagram has no tables: how to start. */
export function EmptyCanvas({ onAddTable }: { onAddTable: () => void }) {
  const empty = useEditorStore(
    (state) => selectDiagram(state).tables.length === 0,
  );
  if (!empty) return null;

  return (
    <Panel
      position="center-left"
      className="!top-1/2 !left-1/2 flex w-[min(460px,calc(100%-32px))] !-translate-x-1/2 !-translate-y-1/2 flex-col gap-3 rounded-control border border-line bg-raised p-6 shadow-float"
    >
      <h2 className="font-display text-[24px] leading-tight font-bold tracking-[0.04em] uppercase">
        Pega un esquema para empezar
      </h2>
      <p className="text-ink-muted">
        Con el lienzo seleccionado, pega con{" "}
        <kbd className="font-mono">Ctrl+V</kbd> un{" "}
        <code className="font-mono">CREATE TABLE</code>, un bloque DBML o un
        esquema de Drizzle. También puedes soltar un archivo aquí o escribir en
        el panel de código.
      </p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          className={PRIMARY}
          onClick={() => editorStore.getState().setView({ importText: "" })}
        >
          Importar esquema
        </button>
        <button type="button" className={BUTTON} onClick={onAddTable}>
          Nueva tabla
        </button>
        <button
          type="button"
          className={BUTTON}
          onClick={() => {
            const { replace, notify } = editorStore.getState();
            replace(createExampleDiagram());
            notify("Cargaste el diagrama de ejemplo.");
          }}
        >
          Cargar ejemplo
        </button>
      </div>
    </Panel>
  );
}
