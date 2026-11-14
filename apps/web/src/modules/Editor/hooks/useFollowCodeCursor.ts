import { useReactFlow, useStoreApi } from "@xyflow/react";
import { useEffect } from "react";
import { TABLE_WIDTH } from "../constants/canvas";
import { inView } from "../utils/canvasElements";
import { useEditorStore } from "./useEditorStore";

const glideDuration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;

/** When the cursor in the code moves into a table that is out of sight, the canvas brings it to the center. */
export function useFollowCodeCursor(): void {
  const codeTableId = useEditorStore((state) => state.view.codeTableId);
  const { getInternalNode, getViewport, setCenter } = useReactFlow();
  const flow = useStoreApi();

  useEffect(() => {
    if (codeTableId === null) return;
    const node = getInternalNode(codeTableId);
    if (!node) return;
    const box = {
      ...node.internals.positionAbsolute,
      width: node.measured.width ?? TABLE_WIDTH,
      height: node.measured.height ?? 0,
    };
    const viewport = getViewport();
    const { width, height } = flow.getState();
    if (inView(box, viewport, { width, height })) return;
    void setCenter(box.x + box.width / 2, box.y + box.height / 2, {
      zoom: viewport.zoom,
      duration: glideDuration(),
    });
  }, [codeTableId, getInternalNode, getViewport, setCenter, flow]);
}
