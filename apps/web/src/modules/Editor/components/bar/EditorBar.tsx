import { Code, Import, LayoutGrid, Plus } from "lucide-react";
import { BrandMark, ThemeSelect } from "../../../shared";
import { selectDiagram } from "../../hooks/EditorStore";
import { useAddTable } from "../../hooks/useAddTable";
import { useAutoLayout } from "../../hooks/useAutoLayout";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { BarButton } from "./BarButton";
import { ChangesMenu } from "./ChangesMenu";
import { DiagramName } from "./DiagramName";
import { DiagramsMenu } from "./DiagramsMenu";
import { SaveState } from "./SaveState";
import { TableSearch } from "./TableSearch";
import { ViewMenu } from "./ViewMenu";

const ICON = { size: 15, strokeWidth: 1.75, "aria-hidden": true } as const;

const Divider = () => (
  <span className="mx-0.5 h-5 w-px flex-none bg-bar-line max-[640px]:hidden" />
);

/**
 * The frame bar, in three parts: the diagram (its name, «Mis diagramas» and
 * whether it is saved), the work on it (import, add, arrange) and how it is
 * seen (view, changes), then search, code and theme on the right. Everything
 * fits without scrolling: as the window narrows, labels give way to icons.
 */
export function EditorBar() {
  const codeOpen = useEditorStore((state) => state.view.codeOpen);
  const hasTables = useEditorStore(
    (state) => selectDiagram(state).tables.length > 0,
  );
  const { arrange, busy } = useAutoLayout();
  const addTable = useAddTable();

  return (
    <header className="flex h-12 items-center gap-2 border-b border-bar-deep bg-bar px-4 text-bar-ink max-[640px]:gap-1.5 max-[640px]:px-2">
      <span className="mr-1 flex flex-none items-center gap-2 font-display text-lg font-bold tracking-[0.14em] whitespace-nowrap uppercase">
        <BrandMark />
        <span className="max-[1279px]:sr-only">Design DB</span>
      </span>
      <div className="flex min-w-0 items-center gap-1">
        <DiagramName />
        <DiagramsMenu />
      </div>
      <SaveState />
      <Divider />
      <BarButton
        primary
        icon={<Import {...ICON} />}
        title="Pegar o abrir SQL, DBML, Drizzle o JSON"
        onClick={() => editorStore.getState().setView({ importText: "" })}
        className="max-[640px]:px-[7px]"
      >
        <span className="max-[640px]:sr-only">Importar</span>
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
      <Divider />
      <ViewMenu />
      <ChangesMenu />
      <span className="flex-1" />
      <TableSearch />
      <BarButton
        compact
        icon={<Code {...ICON} />}
        aria-pressed={codeOpen}
        title={codeOpen ? "Ocultar el código" : "Mostrar el código"}
        className="aria-pressed:border-bar-deep aria-pressed:bg-bar-deep aria-pressed:text-bar-active"
        onClick={() => editorStore.getState().setView({ codeOpen: !codeOpen })}
      >
        Código
      </BarButton>
      <div className="flex-none max-[640px]:hidden">
        <ThemeSelect />
      </div>
    </header>
  );
}
