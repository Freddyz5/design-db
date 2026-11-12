import { ThemeSelect } from "../../shared";
import { selectDiagram } from "../hooks/EditorStore";
import { useEditorStore } from "../hooks/useEditorStore";
import { Canvas } from "./canvas/Canvas";

/** The diagram editor, mounted by /app as a client-only React island. */
export function Editor() {
  const name = useEditorStore((state) => selectDiagram(state).name);

  return (
    <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)]">
      <header className="flex h-12 items-center gap-3 border-b border-frame-deep bg-frame px-4 text-frame-ink">
        <span className="font-display text-lg font-bold tracking-[0.14em] uppercase">
          Design DB
        </span>
        <span className="rounded-control bg-frame-well px-2.5 py-1 font-display text-[15px] font-semibold tracking-wide">
          {name}
        </span>
        <span className="flex-1" />
        <ThemeSelect />
      </header>
      <main className="min-h-0 bg-canvas" aria-label="Lienzo del diagrama">
        <Canvas />
      </main>
    </div>
  );
}
