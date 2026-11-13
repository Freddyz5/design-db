import { createDiagram, diffDiagram } from "@design-db/core";
import { Code, FilePlus, Import, LayoutGrid, Plus } from "lucide-react";
import { ThemeSelect } from "../../../shared";
import { selectDiagram } from "../../hooks/EditorStore";
import { useAddTable } from "../../hooks/useAddTable";
import { useAutoLayout } from "../../hooks/useAutoLayout";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { COLUMNS_FILTERS, RELATIONS_FILTERS } from "../../constants/filters";
import { useOverflowEnd } from "../../hooks/useOverflowEnd";
import { BarButton } from "./BarButton";
import { BarSegment } from "./BarSegment";
import { BaseButton } from "./BaseButton";
import { TableSearch } from "./TableSearch";

const ICON = { size: 15, strokeWidth: 1.75, "aria-hidden": true } as const;

/** The frame bar: the name of the product and of the diagram, and the tools. */
export function EditorBar() {
  const name = useEditorStore((state) => selectDiagram(state).name);
  const columnsFilter = useEditorStore((state) => state.view.columnsFilter);
  const relationsFilter = useEditorStore((state) => state.view.relationsFilter);
  const codeOpen = useEditorStore((state) => state.view.codeOpen);
  const hasTables = useEditorStore(
    (state) => selectDiagram(state).tables.length > 0,
  );
  const baseAt = useEditorStore((state) => selectDiagram(state).base?.at);
  const showChanges = useEditorStore((state) => state.view.showChanges);
  const changeCount = useEditorStore(
    (state) => diffDiagram(selectDiagram(state))?.length ?? 0,
  );
  const { arrange, busy } = useAutoLayout();
  const addTable = useAddTable();
  const { tools, more, measure } = useOverflowEnd();

  /** Starts an empty diagram. It is one step, so undoing brings the old one back. */
  const startNew = () => {
    const { replace, notify } = editorStore.getState();
    const { dialect } = selectDiagram(editorStore.getState());
    replace(createDiagram({ name: "Sin título", dialect }));
    notify("Empezaste un diagrama nuevo.");
  };

  return (
    <header className="flex h-12 items-center gap-2 border-b border-frame-deep bg-frame px-4 text-frame-ink max-[560px]:px-2">
      <span className="mr-1 flex-none font-display text-lg font-bold tracking-[0.14em] whitespace-nowrap uppercase max-[560px]:hidden">
        Design DB
      </span>
      <span
        className="max-w-60 min-w-12 flex-none truncate max-[560px]:max-w-28 rounded-control bg-frame-well px-2.5 py-1 font-display text-[15px] font-semibold tracking-wide"
        title={name}
      >
        {name}
      </span>
      <BarButton
        compact
        icon={<FilePlus {...ICON} />}
        title="Empezar un diagrama vacío"
        onClick={startNew}
      >
        Nuevo
      </BarButton>
      {/* The tools scroll sideways when the window is too narrow for them; a fade says there is more. */}
      <div
        ref={tools}
        onScroll={measure}
        className={`relative flex min-w-0 flex-1 items-center gap-2 overflow-x-auto [scrollbar-width:none] ${more ? "[mask-image:linear-gradient(to_right,black_calc(100%-40px),transparent)]" : ""}`}
      >
        <span className="mx-1 h-5 w-px flex-none bg-frame-line" />
        <BarButton
          primary
          icon={<Import {...ICON} />}
          title="Pegar o abrir SQL, DBML, Drizzle o JSON"
          onClick={() => editorStore.getState().setView({ importText: "" })}
        >
          Importar
        </BarButton>
        <BarButton
          compact
          icon={<Plus {...ICON} />}
          title="Nueva tabla"
          onClick={addTable}
        >
          Nueva tabla
        </BarButton>
        <BarButton
          compact
          icon={<LayoutGrid {...ICON} />}
          title="Ordenar automáticamente todas las tablas"
          disabled={!hasTables || busy}
          aria-busy={busy}
          onClick={() => void arrange()}
        >
          {busy ? "Ordenando…" : "Ordenar"}
        </BarButton>
        <span className="mx-1 h-5 w-px flex-none bg-frame-line" />
        <BarSegment
          legend="Columnas visibles"
          options={COLUMNS_FILTERS}
          value={columnsFilter}
          onChange={(value) =>
            editorStore.getState().setView({ columnsFilter: value })
          }
        />
        <BarSegment
          legend="Relaciones visibles"
          options={RELATIONS_FILTERS}
          value={relationsFilter}
          onChange={(value) =>
            editorStore.getState().setView({ relationsFilter: value })
          }
        />
        <span className="mx-1 h-5 w-px flex-none bg-frame-line" />
        <BaseButton at={baseAt} />
        <BarButton
          aria-pressed={showChanges}
          disabled={baseAt === undefined}
          title={
            baseAt === undefined
              ? "Fija una base para ver qué cambió desde entonces"
              : "Marcar lo nuevo, lo que cambió y lo eliminado desde la base"
          }
          className="aria-pressed:border-frame-deep aria-pressed:bg-frame-deep aria-pressed:text-lamp"
          onClick={() =>
            editorStore.getState().setView({ showChanges: !showChanges })
          }
        >
          Cambios
          {baseAt !== undefined && (
            <span className="font-mono text-[11.5px] opacity-80">
              {changeCount}
            </span>
          )}
        </BarButton>
      </div>
      <TableSearch />
      <BarButton
        compact
        icon={<Code {...ICON} />}
        aria-pressed={codeOpen}
        title={codeOpen ? "Ocultar el código" : "Mostrar el código"}
        className="aria-pressed:border-frame-deep aria-pressed:bg-frame-deep aria-pressed:text-lamp"
        onClick={() => editorStore.getState().setView({ codeOpen: !codeOpen })}
      >
        Código
      </BarButton>
      <ThemeSelect />
    </header>
  );
}
