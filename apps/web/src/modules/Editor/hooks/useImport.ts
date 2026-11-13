import type { MergeMode } from "@design-db/core";
import { useReactFlow } from "@xyflow/react";
import { useCallback } from "react";
import { layoutUnplaced } from "../utils/autoLayout";
import { drawnSizes } from "../utils/canvasElements";
import { browserLayouter } from "../utils/elkWorker";
import { runImport } from "../utils/schemaImport";
import { selectDiagram } from "./EditorStore";
import { editorStore } from "./useEditorStore";

const fitDuration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300;

/**
 * Imports a text into the diagram as one undo step: the tables that come
 * without a position are laid out next to the others, the imported tables
 * are selected and the canvas shows the whole diagram.
 * Resolves to false when the text cannot be imported.
 */
export function useImport(): (
  text: string,
  mode: MergeMode,
) => Promise<boolean> {
  const { fitView } = useReactFlow();

  return useCallback(
    async (text, mode) => {
      const state = editorStore.getState();
      const base = selectDiagram(state);
      const outcome = runImport(base, text, mode);
      if (!outcome) return false;

      let { diagram } = outcome;
      if (outcome.unplaced.length > 0) {
        const positions = await layoutUnplaced(
          diagram,
          drawnSizes(diagram, state.view.columnsFilter),
          browserLayouter(),
        );
        diagram = {
          ...diagram,
          layout: {
            ...diagram.layout,
            tables: { ...diagram.layout.tables, ...positions },
          },
        };
      }

      const { replace, setView, notify } = editorStore.getState();
      replace(diagram);
      setView({ selection: outcome.imported, importText: null });
      notify(outcome.notice);
      requestAnimationFrame(() =>
        fitView({ padding: 0.15, maxZoom: 1, duration: fitDuration() }),
      );
      return true;
    },
    [fitView],
  );
}
