import { selectDiagram } from "../hooks/EditorStore";
import { useEditorStore } from "../hooks/useEditorStore";

/** The diagram editor, mounted by /app as a client-only React island. */
export function Editor() {
  const diagram = useEditorStore(selectDiagram);

  return (
    <main className="grid h-dvh place-items-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Design DB</h1>
        <p>
          {diagram.name} · {diagram.tables.length} tablas
        </p>
      </div>
    </main>
  );
}
