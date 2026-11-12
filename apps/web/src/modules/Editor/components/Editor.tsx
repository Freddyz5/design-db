import { ReactFlowProvider } from "@xyflow/react";
import { EditorBar } from "./bar/EditorBar";
import { Canvas } from "./canvas/Canvas";

/** The diagram editor, mounted by /app as a client-only React island. */
export function Editor() {
  return (
    // The provider wraps the bar too: its tools need to know what the canvas shows.
    <ReactFlowProvider>
      <div className="grid h-dvh grid-rows-[auto_minmax(0,1fr)]">
        <EditorBar />
        <main className="min-h-0 bg-canvas" aria-label="Lienzo del diagrama">
          <Canvas />
        </main>
      </div>
    </ReactFlowProvider>
  );
}
