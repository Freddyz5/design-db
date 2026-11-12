import { ThemeSelect } from "../../shared";
import { selectDiagram } from "../hooks/EditorStore";
import { useEditorStore } from "../hooks/useEditorStore";

/** The diagram editor, mounted by /app as a client-only React island. */
export function Editor() {
  const diagram = useEditorStore(selectDiagram);

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)]">
      <header className="flex h-12 items-center gap-3 border-b border-frame-deep bg-frame px-4 text-frame-ink">
        <span className="font-display text-lg font-bold tracking-[0.14em] uppercase">
          Design DB
        </span>
        <span className="rounded-control bg-frame-well px-2.5 py-1 font-display text-[15px] font-semibold tracking-wide">
          {diagram.name}
        </span>
        <span className="flex-1" />
        <ThemeSelect />
      </header>
      <main className="grid place-items-center bg-canvas bg-[radial-gradient(circle,var(--color-canvas-dot)_1.1px,transparent_1.4px)] bg-size-[24px_24px]">
        <p className="rounded-control border border-line bg-raised px-3 py-1.5 text-ink-muted shadow-float">
          {diagram.tables.length} tablas · {diagram.relations.length} relaciones
        </p>
      </main>
    </div>
  );
}
