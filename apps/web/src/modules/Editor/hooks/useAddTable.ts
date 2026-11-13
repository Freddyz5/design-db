import { useReactFlow, useStoreApi } from "@xyflow/react";
import { useCallback } from "react";
import {
  TABLE_HEADER_HEIGHT,
  TABLE_ROW_HEIGHT,
  TABLE_WIDTH,
} from "../constants/canvas";
import { createDefaultTable, freePosition } from "../utils/diagramEdits";
import { selectDiagram } from "./EditorStore";
import { editorStore } from "./useEditorStore";

/** Adds a table in the middle of what the canvas shows, and opens it to be edited. */
export function useAddTable(): () => void {
  const { screenToFlowPosition } = useReactFlow();
  const canvas = useStoreApi();

  return useCallback(() => {
    const { dispatch, setView } = editorStore.getState();
    const diagram = selectDiagram(editorStore.getState());
    const table = createDefaultTable(diagram);

    const box = canvas.getState().domNode?.getBoundingClientRect();
    const middle = box
      ? screenToFlowPosition({
          x: box.left + box.width / 2,
          y: box.top + box.height / 2,
        })
      : { x: 0, y: 0 };
    const position = freePosition(diagram, {
      x: middle.x - TABLE_WIDTH / 2,
      y: middle.y - (TABLE_HEADER_HEIGHT + TABLE_ROW_HEIGHT) / 2,
    });

    dispatch({ type: "table.add", table, position });
    setView({ selection: [table.id], editingTableId: table.id });
  }, [canvas, screenToFlowPosition]);
}
