import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  ReactFlow,
  SelectionMode,
  applyNodeChanges,
  useKeyPress,
  type EdgeChange,
  type NodeChange,
  type OnConnectEnd,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  GRID_MAJOR_EVERY,
  GRID_MINOR,
  MAX_ZOOM,
  MIN_ZOOM,
} from "../../constants/canvas";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import {
  dragHandleColumn,
  ghostNodes,
  groupNodes,
  nextSelection,
  relationEdges,
  tableNodes,
  type CanvasNode,
  type GhostNode,
  type GroupNode,
  type RelationEdge,
  type TableNode,
} from "../../utils/canvasElements";
import { linkColumns } from "../../utils/relationEdits";
import { useAddTable } from "../../hooks/useAddTable";
import { useFollowCodeCursor } from "../../hooks/useFollowCodeCursor";
import { useShortcuts } from "../../hooks/useShortcuts";
import { CanvasControls } from "./CanvasControls";
import { ChangesPanel } from "./ChangesPanel";
import { EmptyCanvas } from "./EmptyCanvas";
import { GhostNodeView } from "./GhostNode";
import { GroupNodeView } from "./GroupNode";
import { Notice } from "./Notice";
import { RelationBar } from "./RelationBar";
import { RelationEdgeView } from "./RelationEdge";
import { SelectionBar } from "./SelectionBar";
import { TablePanel } from "../table-panel/TablePanel";
import { TableNodeView } from "./TableNode";

const nodeTypes = {
  table: TableNodeView,
  zone: GroupNodeView,
  ghost: GhostNodeView,
};
const edgeTypes = { relation: RelationEdgeView };

const FIT = { padding: 0.15, maxZoom: 1 };

/** Shift, Ctrl or Cmd + click adds a table to the selection or takes it out. */
const MULTI_SELECT = ["Shift", "Meta", "Control"];
/** The background pans with the left button and with the middle one; with Shift held, the left button draws a box instead. */
const PAN_BUTTONS = [0, 1];
const PAN_BUTTONS_SELECTING = [1];

/** The line that follows the pointer while a relation is dragged. */
const LINK_LINE = {
  stroke: "var(--color-accent-ink)",
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
  // The pinned table holds the focus; without one, the table under the
  // pointer; without one, the table the cursor is in, in the code.
  const focusedTableId = useEditorStore(
    (state) =>
      state.view.pinnedTableId ??
      state.view.hoveredTableId ??
      state.view.codeTableId,
  );
  const flash = useEditorStore((state) => state.view.flash);
  const view = useMemo(
    () => ({
      flash,
      selection,
      selectedRelationId,
      columns,
      relations,
      showChanges,
      focusedTableId,
    }),
    [
      selection,
      selectedRelationId,
      columns,
      relations,
      showChanges,
      focusedTableId,
      flash,
    ],
  );
  const addTable = useAddTable();
  useShortcuts();
  useFollowCodeCursor();
  // Shift both draws a box on the background and adds a clicked table to the
  // selection. React Flow's own box key would turn that click into an empty
  // box, so the box is drawn by dragging the background while Shift is held.
  const shiftHeld = useKeyPress("Shift");
  /** True while a relation is being dragged from a column. */
  const [linking, setLinking] = useState(false);
  /** While something is dragged, the focus stays where it was. */
  const busy = useRef(false);
  busy.current = linking;

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
  // Tables removed since the base, where they stood, under the live ones.
  const lastGhosts = useRef<GhostNode[]>([]);
  const ghosts = useMemo(() => {
    lastGhosts.current = ghostNodes(diagram, lastGhosts.current, view);
    return lastGhosts.current;
  }, [diagram, view]);
  const canvasNodes = useMemo<CanvasNode[]>(
    () => [...groups, ...ghosts, ...nodes],
    [groups, ghosts, nodes],
  );

  const lastEdges = useRef<RelationEdge[]>([]);
  const edges = useMemo(() => {
    lastEdges.current = relationEdges(diagram, nodes, lastEdges.current, view);
    return lastEdges.current;
  }, [diagram, nodes, view]);

  // Only the tables are kept here; a group region is worked out from them.
  // The selection lives in the store alone: the canvas draws it from there.
  // Keeping a second copy here let the two answer each other forever when a
  // click both selected and dragged a table.
  const onNodesChange = useCallback((changes: NodeChange<CanvasNode>[]) => {
    const picks = changes.filter((change) => change.type === "select");
    if (picks.length > 0) {
      const { view, setView } = editorStore.getState();
      const selection = nextSelection(view.selection, picks);
      if (selection !== view.selection) setView({ selection });
    }
    const rest = changes.filter((change) => change.type !== "select");
    if (rest.length === 0) return;
    setNodes((current) => {
      const ids = new Set(current.map((node) => node.id));
      const own = rest.filter(
        (change) => !("id" in change) || ids.has(change.id),
      ) as NodeChange<TableNode>[];
      return own.length > 0 ? applyNodeChanges(own, current) : current;
    });
  }, []);

  /** True while a table or a group is dragged. */
  const dragging = useRef(false);

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
      dragging.current = true;
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
      dragging.current = false;
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

  // Which relation is selected lives in the store too. A click or Enter on
  // the relation selects it; a box over some tables picks the tables, not
  // their relations.
  const onEdgesChange = useCallback((changes: EdgeChange<RelationEdge>[]) => {
    for (const change of changes) {
      if (change.type !== "select") continue;
      const { view, setView } = editorStore.getState();
      if (change.selected) {
        const focused = document.activeElement?.closest(".react-flow__edge");
        if (focused?.getAttribute("data-id") === change.id) {
          setView({ selectedRelationId: change.id });
        }
      } else if (view.selectedRelationId === change.id) {
        setView({ selectedRelationId: null });
      }
    }
  }, []);
  const onEdgeClick = useCallback(
    (_event: ReactMouseEvent, edge: RelationEdge) =>
      editorStore.getState().setView({ selectedRelationId: edge.id }),
    [],
  );

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

  // The table under the pointer stands out, with the tables related to it.
  const hover = useCallback((tableId: string | null) => {
    if (busy.current || dragging.current) return;
    const { view, setView } = editorStore.getState();
    if (view.hoveredTableId !== tableId) setView({ hoveredTableId: tableId });
  }, []);

  // A click on a table fixes the focus on it; a second click on its name lets
  // go. A click on one of its columns keeps it fixed. With Shift or Ctrl the
  // click only adds to the selection.
  const onNodeClick = useCallback(
    (event: ReactMouseEvent, node: CanvasNode) => {
      if (!isTable(node) || event.shiftKey || event.metaKey || event.ctrlKey) {
        return;
      }
      const columnId =
        event.target instanceof Element
          ? (event.target
              .closest("[data-column-id]")
              ?.getAttribute("data-column-id") ?? null)
          : null;
      const { view, setView } = editorStore.getState();
      setView({
        pinnedTableId:
          view.pinnedTableId === node.id && columnId === null ? null : node.id,
        // The code shows the table, on the clicked column.
        codeTarget: { tableId: node.id, columnId, focus: false },
      });
    },
    [],
  );

  // A click on the background lets go of the selection and the focus.
  const onPaneClick = useCallback(() => {
    const { view, setView } = editorStore.getState();
    if (view.pinnedTableId !== null || view.selection.length > 0) {
      setView({ pinnedTableId: null, selection: [] });
    }
  }, []);

  return (
    <ReactFlow
      nodes={canvasNodes}
      edges={edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      className={linking ? "linking" : undefined}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgeClick={onEdgeClick}
      onConnectStart={() => setLinking(true)}
      onConnectEnd={onConnectEnd}
      connectionLineStyle={LINK_LINE}
      onNodeDragStart={onNodeDragStart}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      onNodeMouseEnter={(_event, node) => {
        if (isTable(node)) hover(node.id);
      }}
      onNodeMouseLeave={() => hover(null)}
      onPaneMouseLeave={() => hover(null)}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onNodeDoubleClick={(_event, node) => {
        if (!isTable(node)) return;
        editorStore
          .getState()
          .setView({ selection: [node.id], editingTableId: node.id });
      }}
      onSelectionDragStop={(_event, dragged) => place(dragged)}
      selectionMode={SelectionMode.Partial}
      multiSelectionKeyCode={MULTI_SELECT}
      selectionKeyCode={null}
      selectionOnDrag={shiftHeld}
      panOnDrag={shiftHeld ? PAN_BUTTONS_SELECTING : PAN_BUTTONS}
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
      {/* Drawing paper: a fine grid and a bolder one every five squares. Both scale with the zoom. */}
      <Background
        id="grid-minor"
        variant={BackgroundVariant.Lines}
        gap={GRID_MINOR}
        lineWidth={1}
        color="var(--color-grid)"
      />
      <Background
        id="grid-major"
        variant={BackgroundVariant.Lines}
        gap={GRID_MINOR * GRID_MAJOR_EVERY}
        lineWidth={1}
        color="var(--color-grid-major)"
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
