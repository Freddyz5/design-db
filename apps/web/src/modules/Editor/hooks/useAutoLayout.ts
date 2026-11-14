import { useReactFlow } from "@xyflow/react";
import { useCallback, useState } from "react";
import { autoLayout } from "../utils/autoLayout";
import { drawnSizes } from "../utils/canvasElements";
import { browserLayouter } from "../utils/elkWorker";
import { selectDiagram } from "./EditorStore";
import { editorStore } from "./useEditorStore";

/** How long the canvas takes to show the whole diagram after it is laid out. Nothing under reduced motion. */
const fitDuration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300;

/** Lays out every table of the diagram as one undo step, then shows the whole diagram. */
export function useAutoLayout(): {
  arrange: () => Promise<void>;
  busy: boolean;
} {
  const { fitView } = useReactFlow();
  const [busy, setBusy] = useState(false);

  const arrange = useCallback(async () => {
    const state = editorStore.getState();
    const diagram = selectDiagram(state);
    setBusy(true);
    try {
      const positions = await autoLayout(
        diagram,
        drawnSizes(diagram, state.view.columnsFilter),
        browserLayouter(),
      );
      // The diagram may have changed while the worker ran: place only what still exists.
      const now = selectDiagram(editorStore.getState());
      const placed = Object.fromEntries(
        Object.entries(positions).filter(([id]) =>
          now.tables.some((table) => table.id === id),
        ),
      );
      if (Object.keys(placed).length === 0) return;
      editorStore
        .getState()
        .dispatch({ type: "layout.place", positions: placed });
      editorStore.getState().notify("Ordenaste el diagrama.");
      // Wait for the canvas to draw the new positions before fitting them.
      requestAnimationFrame(() =>
        fitView({ padding: 0.15, maxZoom: 1, duration: fitDuration() }),
      );
    } finally {
      setBusy(false);
    }
  }, [fitView]);

  return { arrange, busy };
}
