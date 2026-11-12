import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  applyNodeChanges,
  type NodeChange,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_ZOOM, MIN_ZOOM } from "../../constants/canvas";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import {
  relationEdges,
  tableNodes,
  type RelationEdge,
  type TableNode,
} from "../../utils/canvasElements";
import { CanvasControls } from "./CanvasControls";
import { Notice } from "./Notice";
import { RelationEdgeView } from "./RelationEdge";
import { SelectionBar } from "./SelectionBar";
import { TableNodeView } from "./TableNode";

const nodeTypes = { table: TableNodeView };
const edgeTypes = { relation: RelationEdgeView };

const FIT = { padding: 0.15, maxZoom: 1 };

/** What a screen reader hears on the canvas, in Spanish. */
const ARIA_LABELS = {
  "node.a11yDescription.default":
    "Pulsa Enter o Espacio para seleccionar la tabla. Pulsa Escape para cancelar.",
  "node.a11yDescription.keyboardDisabled":
    "Pulsa Enter o Espacio para seleccionar la tabla. Después puedes moverla con las flechas. Pulsa Escape para cancelar.",
  "node.a11yDescription.ariaLiveMessage": ({
    direction,
    x,
    y,
  }: {
    direction: string;
    x: number;
    y: number;
  }) => `Tabla movida (${direction}). Nueva posición: x ${x}, y ${y}.`,
  "edge.a11yDescription.default":
    "Pulsa Enter o Espacio para seleccionar la relación. Pulsa Escape para cancelar.",
};

/** Places the tables where they were dropped: one change to the diagram, so one step to undo. */
function place(dragged: readonly TableNode[]) {
  const positions = Object.fromEntries(
    dragged.map((node) => [
      node.id,
      { x: Math.round(node.position.x), y: Math.round(node.position.y) },
    ]),
  );
  editorStore.getState().dispatch({ type: "layout.place", positions });
}

/**
 * The canvas: tables as nodes, relations as edges. Drag the background to
 * pan, Ctrl + wheel or pinch to zoom, Shift + drag to select several tables.
 */
export function Canvas() {
  const diagram = useEditorStore(selectDiagram);
  const selection = useEditorStore((state) => state.view.selection);

  // The canvas keeps its own copy of the nodes: while a table is dragged its
  // position here is ahead of the diagram, which only changes when it is dropped.
  const [nodes, setNodes] = useState<TableNode[]>(() =>
    tableNodes(diagram, [], selection),
  );
  useEffect(() => {
    setNodes((current) => tableNodes(diagram, current, selection));
  }, [diagram, selection]);

  const lastEdges = useRef<RelationEdge[]>([]);
  const edges = useMemo(() => {
    lastEdges.current = relationEdges(diagram, nodes, lastEdges.current);
    return lastEdges.current;
  }, [diagram, nodes]);

  const onNodesChange = useCallback(
    (changes: NodeChange<TableNode>[]) =>
      setNodes((current) => applyNodeChanges(changes, current)),
    [],
  );

  const onNodeDragStop = useCallback<OnNodeDrag<TableNode>>(
    (_event, _node, dragged) => place(dragged),
    [],
  );

  // The selection lives in the store; the canvas reports what the user picked.
  const onSelectionChange = useCallback<OnSelectionChangeFunc<TableNode>>(
    ({ nodes: picked }) => {
      const ids = picked.map((node) => node.id);
      const current = editorStore.getState().view.selection;
      const same =
        ids.length === current.length &&
        ids.every((id) => current.includes(id));
      if (!same) editorStore.getState().setView({ selection: ids });
    },
    [],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStop={onNodeDragStop}
      onSelectionDragStop={(_event, dragged) => place(dragged)}
      onSelectionChange={onSelectionChange}
      selectionMode={SelectionMode.Partial}
      connectionMode={ConnectionMode.Loose}
      nodesConnectable={false}
      deleteKeyCode={null}
      panOnScroll
      zoomOnScroll={false}
      zoomOnDoubleClick={false}
      minZoom={MIN_ZOOM}
      maxZoom={MAX_ZOOM}
      fitView
      fitViewOptions={FIT}
      ariaLabelConfig={ARIA_LABELS}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.6}
        color="var(--color-canvas-dot)"
      />
      <SelectionBar />
      <CanvasControls />
      <Notice />
    </ReactFlow>
  );
}
