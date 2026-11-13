import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  applyNodeChanges,
  type EdgeChange,
  type NodeChange,
  type OnConnectEnd,
  type OnNodeDrag,
  type OnSelectionChangeFunc,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_ZOOM, MIN_ZOOM } from "../../constants/canvas";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import {
  dragHandleColumn,
  groupNodes,
  relationEdges,
  tableNodes,
  type CanvasNode,
  type GroupNode,
  type RelationEdge,
  type TableNode,
} from "../../utils/canvasElements";
import { linkColumns } from "../../utils/relationEdits";
import { useAddTable } from "../../hooks/useAddTable";
import { CanvasControls } from "./CanvasControls";
import { ChangesPanel } from "./ChangesPanel";
import { EmptyCanvas } from "./EmptyCanvas";
import { GroupNodeView } from "./GroupNode";
import { Notice } from "./Notice";
import { RelationBar } from "./RelationBar";
import { RelationEdgeView } from "./RelationEdge";
import { SelectionBar } from "./SelectionBar";
import { TablePanel } from "../table-panel/TablePanel";
import { TableNodeView } from "./TableNode";

const nodeTypes = { table: TableNodeView, zone: GroupNodeView };
const edgeTypes = { relation: RelationEdgeView };

const FIT = { padding: 0.15, maxZoom: 1 };

/** The line that follows the pointer while a relation is dragged. */
const LINK_LINE = {
  stroke: "var(--color-lamp-ink)",
  strokeWidth: 2,
  strokeDasharray: "6 4",
};

/** Where a pointer or touch event happened on the screen. */
function pointOf(event: MouseEvent | TouchEvent): { x: number; y: number } {
  const at = "changedTouches" in event ? event.changedTouches[0] : event;
  return at ? { x: at.clientX, y: at.clientY } : { x: 0, y: 0 };
}

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

const isTable = (node: CanvasNode): node is TableNode => node.type === "table";

/** Places the tables where they were dropped: one change to the diagram, so one step to undo. */
function place(dragged: readonly CanvasNode[]) {
  const tables = dragged.filter(isTable);
  if (tables.length === 0) return;
  const positions = Object.fromEntries(
    tables.map((node) => [
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
  const selectedRelationId = useEditorStore(
    (state) => state.view.selectedRelationId,
  );
  const columns = useEditorStore((state) => state.view.columnsFilter);
  const relations = useEditorStore((state) => state.view.relationsFilter);
  const showChanges = useEditorStore(
    (state) =>
      state.view.showChanges && selectDiagram(state).base !== undefined,
  );
  const view = useMemo(
    () => ({ selection, selectedRelationId, columns, relations, showChanges }),
    [selection, selectedRelationId, columns, relations, showChanges],
  );
  const addTable = useAddTable();
  /** True while a relation is being dragged from a column. */
  const [linking, setLinking] = useState(false);

  // The canvas keeps its own copy of the nodes: while a table is dragged its
  // position here is ahead of the diagram, which only changes when it is dropped.
  const [nodes, setNodes] = useState<TableNode[]>(() =>
    tableNodes(diagram, [], view),
  );
  useEffect(() => {
    setNodes((current) => tableNodes(diagram, current, view));
  }, [diagram, view]);

  // The regions of the groups follow the tables, also while they are dragged.
  const lastGroups = useRef<GroupNode[]>([]);
  const groups = useMemo(() => {
    lastGroups.current = groupNodes(diagram, nodes, lastGroups.current);
    return lastGroups.current;
  }, [diagram, nodes]);
  const canvasNodes = useMemo<CanvasNode[]>(
    () => [...groups, ...nodes],
    [groups, nodes],
  );

  const lastEdges = useRef<RelationEdge[]>([]);
  const edges = useMemo(() => {
    lastEdges.current = relationEdges(diagram, nodes, lastEdges.current, view);
    return lastEdges.current;
  }, [diagram, nodes, view]);

  // Only the tables are kept here; a group region is worked out from them.
  const onNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) =>
      setNodes((current) => {
        const ids = new Set(current.map((node) => node.id));
        const own = changes.filter(
          (change) => !("id" in change) || ids.has(change.id),
        ) as NodeChange<TableNode>[];
        return own.length > 0 ? applyNodeChanges(own, current) : current;
      }),
    [],
  );

  // Dragging a group by its name moves its tables: where the group and each
  // of its tables were when the drag started.
  const groupDrag = useRef<{
    from: { x: number; y: number };
    tables: Map<string, { x: number; y: number }>;
  } | null>(null);
  const tablesNow = useRef(nodes);
  tablesNow.current = nodes;

  const onNodeDragStart = useCallback<OnNodeDrag<CanvasNode>>(
    (_event, node) => {
      if (node.type !== "zone") return;
      const groupId = node.data.group.id;
      groupDrag.current = {
        from: { ...node.position },
        tables: new Map(
          tablesNow.current
            .filter((table) => table.data.table.groupId === groupId)
            .map((table) => [table.id, { ...table.position }]),
        ),
      };
    },
    [],
  );

  const onNodeDrag = useCallback<OnNodeDrag<CanvasNode>>((_event, node) => {
    const drag = groupDrag.current;
    if (node.type !== "zone" || !drag) return;
    const dx = node.position.x - drag.from.x;
    const dy = node.position.y - drag.from.y;
    setNodes((current) =>
      current.map((table) => {
        const start = drag.tables.get(table.id);
        return start
          ? { ...table, position: { x: start.x + dx, y: start.y + dy } }
          : table;
      }),
    );
  }, []);

  const onNodeDragStop = useCallback<OnNodeDrag<CanvasNode>>(
    (_event, node, dragged) => {
      const drag = groupDrag.current;
      groupDrag.current = null;
      if (node.type === "zone" && drag) {
        place(tablesNow.current.filter((table) => drag.tables.has(table.id)));
      } else {
        place(dragged);
      }
    },
    [],
  );

  // Which relation is selected lives in the store too.
  const onEdgesChange = useCallback((changes: EdgeChange<RelationEdge>[]) => {
    for (const change of changes) {
      if (change.type !== "select") continue;
      const { view, setView } = editorStore.getState();
      if (change.selected) setView({ selectedRelationId: change.id });
      else if (view.selectedRelationId === change.id) {
        setView({ selectedRelationId: null });
      }
    }
  }, []);

  // A relation is dragged from a column and dropped anywhere on a table, or
  // on one of its columns: what is under the pointer decides the target.
  const onConnectEnd = useCallback<OnConnectEnd>((event, connection) => {
    setLinking(false);
    const from = connection.fromNode?.id;
    const handle = connection.fromHandle?.id;
    if (!from || !handle) return;

    const { x, y } = pointOf(event);
    const under = document.elementFromPoint(x, y);
    const tableId = under
      ?.closest<HTMLElement>("[data-table-id]")
      ?.getAttribute("data-table-id");
    if (!tableId) return;
    const columnId =
      under
        ?.closest<HTMLElement>("[data-column-id]")
        ?.getAttribute("data-column-id") ?? undefined;

    const { replace, notify } = editorStore.getState();
    const edit = linkColumns(
      selectDiagram(editorStore.getState()),
      { tableId: from, columnId: dragHandleColumn(handle) },
      columnId === undefined ? { tableId } : { tableId, columnId },
    );
    if (!edit) return;
    replace(edit.diagram);
    notify(edit.notice);
  }, []);

  // The selection lives in the store; the canvas reports what the user picked.
  const onSelectionChange = useCallback<OnSelectionChangeFunc<CanvasNode>>(
    ({ nodes: picked }) => {
      const ids = picked.filter(isTable).map((node) => node.id);
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
      nodes={canvasNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      className={linking ? "linking" : undefined}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnectStart={() => setLinking(true)}
      onConnectEnd={onConnectEnd}
      connectionLineStyle={LINK_LINE}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      onNodeDoubleClick={(_event, node) => {
        if (!isTable(node)) return;
        editorStore
          .getState()
          .setView({ selection: [node.id], editingTableId: node.id });
      }}
      onSelectionDragStop={(_event, dragged) => place(dragged)}
      onSelectionChange={onSelectionChange}
      selectionMode={SelectionMode.Partial}
      connectionMode={ConnectionMode.Loose}
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
      <EmptyCanvas onAddTable={addTable} />
      <ChangesPanel />
      <SelectionBar />
      <RelationBar />
      <TablePanel />
      <CanvasControls />
      <Notice />
    </ReactFlow>
  );
}
