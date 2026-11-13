import { ReactFlowProvider } from "@xyflow/react";
import { useEffect, useState, type DragEvent } from "react";
import { editorStore, useEditorStore } from "../hooks/useEditorStore";
import { readTextFile } from "../utils/readTextFile";
import { EditorBar } from "./bar/EditorBar";
import { Canvas } from "./canvas/Canvas";
import { CodePanel } from "./code-panel/CodePanel";
import { CodeSplitter } from "./code-panel/CodeSplitter";
import { ImportDialog } from "./import/ImportDialog";

/** Whether the user is typing somewhere: then a paste belongs to that field. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select, .cm-editor") !== null)
  );
}

const hasFiles = (event: DragEvent) =>
  [...event.dataTransfer.types].includes("Files");

/** The diagram editor, mounted by /app as a client-only React island. */
export function Editor() {
  const codeOpen = useEditorStore((state) => state.view.codeOpen);
  const [dropping, setDropping] = useState(false);

  // Pasting a schema anywhere outside a field opens it in the import dialog.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (isTyping(event.target)) return;
      if (editorStore.getState().view.importText !== null) return;
      const text = event.clipboardData?.getData("text/plain") ?? "";
      if (!text.trim()) return;
      event.preventDefault();
      editorStore.getState().setView({ importText: text });
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  return (
    // The provider wraps the bar too: its tools need to know what the canvas shows.
    <ReactFlowProvider>
      <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]">
        <EditorBar />
        <div className="relative flex min-h-0">
          <main
            className="relative min-w-0 flex-1 bg-canvas"
            aria-label="Lienzo del diagrama"
            onDragOver={(event) => {
              if (!hasFiles(event)) return;
              event.preventDefault();
              setDropping(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDropping(false);
              }
            }}
            onDrop={async (event) => {
              if (!hasFiles(event)) return;
              event.preventDefault();
              setDropping(false);
              const file = event.dataTransfer.files[0];
              if (file) {
                editorStore
                  .getState()
                  .setView({ importText: await readTextFile(file) });
              }
            }}
          >
            <Canvas />
            {dropping && (
              <div className="pointer-events-none absolute inset-2.5 z-20 grid place-items-center rounded-[4px] border-2 border-dashed border-lamp-ink bg-canvas/85 font-display text-[22px] font-bold tracking-[0.06em] text-lamp-ink uppercase">
                Suelta el archivo para importarlo
              </div>
            )}
          </main>
          {codeOpen && (
            <>
              <CodeSplitter />
              <CodePanel />
            </>
          )}
        </div>
      </div>
      <ImportDialog />
    </ReactFlowProvider>
  );
}
