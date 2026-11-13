import { createDiagram } from "@design-db/core";
import { useReactFlow, useStoreApi } from "@xyflow/react";
import { FilePlus, Plus } from "lucide-react";
import { ThemeSelect } from "../../../shared";
import {
  TABLE_HEADER_HEIGHT,
  TABLE_ROW_HEIGHT,
  TABLE_WIDTH,
} from "../../constants/canvas";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { createDefaultTable, freePosition } from "../../utils/diagramEdits";
import { BarButton } from "./BarButton";

const ICON = { size: 15, strokeWidth: 1.75, "aria-hidden": true } as const;

/** The frame bar: the name of the product and of the diagram, and the tools. */
export function EditorBar() {
  const name = useEditorStore((state) => selectDiagram(state).name);
  const { screenToFlowPosition } = useReactFlow();
  const canvas = useStoreApi();

  /** Adds a table in the middle of what the canvas shows, and opens it to be edited. */
  const addTable = () => {
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
  };

  /** Starts an empty diagram. It is one step, so undoing brings the old one back. */
  const startNew = () => {
    const { replace, notify } = editorStore.getState();
    const { dialect } = selectDiagram(editorStore.getState());
    replace(createDiagram({ name: "Sin título", dialect }));
    notify("Empezaste un diagrama nuevo.");
  };

  return (
    <header className="flex h-12 items-center gap-2 border-b border-frame-deep bg-frame px-4 text-frame-ink">
      <span className="mr-1 font-display text-lg font-bold tracking-[0.14em] uppercase">
        Design DB
      </span>
      <span className="max-w-60 truncate rounded-control bg-frame-well px-2.5 py-1 font-display text-[15px] font-semibold tracking-wide">
        {name}
      </span>
      <BarButton
        icon={<FilePlus {...ICON} />}
        title="Empezar un diagrama vacío"
        onClick={startNew}
      >
        Nuevo
      </BarButton>
      <span className="mx-1 h-5 w-px flex-none bg-frame-line" />
      <BarButton icon={<Plus {...ICON} />} onClick={addTable}>
        Nueva tabla
      </BarButton>
      <span className="flex-1" />
      <ThemeSelect />
    </header>
  );
}
