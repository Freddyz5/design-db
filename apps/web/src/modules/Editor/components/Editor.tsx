import { ReactFlowProvider } from "@xyflow/react";
import { useEditorStore } from "../hooks/useEditorStore";
import { EditorBar } from "./bar/EditorBar";
import { Canvas } from "./canvas/Canvas";
import { CodePanel } from "./code-panel/CodePanel";
import { CodeSplitter } from "./code-panel/CodeSplitter";

/** The diagram editor, mounted by /app as a client-only React island. */
export function Editor() {
  const codeOpen = useEditorStore((state) => state.view.codeOpen);

  return (
    // The provider wraps the bar too: its tools need to know what the canvas shows.
    <ReactFlowProvider>
      <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)]">
        <EditorBar />
        <div className="relative flex min-h-0">
          <main
            className="min-w-0 flex-1 bg-canvas"
            aria-label="Lienzo del diagrama"
          >
            <Canvas />
          </main>
          {codeOpen && (
            <>
              <CodeSplitter />
              <CodePanel />
            </>
          )}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
