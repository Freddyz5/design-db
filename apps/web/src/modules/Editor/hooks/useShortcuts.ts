import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";
import { removeTables } from "../utils/diagramEdits";
import { isTypingTarget, shortcutFor } from "../utils/shortcuts";
import { selectDiagram } from "./EditorStore";
import { useAddTable } from "./useAddTable";
import { editorStore } from "./useEditorStore";

const fitDuration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;

/** The keyboard shortcuts of the editor. They stay quiet while the user types in a field, the code or a dialog. */
export function useShortcuts(): void {
  const { fitView } = useReactFlow();
  const addTable = useAddTable();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isTypingTarget(event.target)) return;
      const action = shortcutFor(event);
      if (!action) return;

      const state = editorStore.getState();
      const { view, setView } = state;
      const diagram = selectDiagram(state);

      switch (action) {
        case "newTable":
          addTable();
          break;
        case "editTable": {
          const [only, ...rest] = view.selection;
          if (!only || rest.length > 0) return;
          setView({ editingTableId: only });
          break;
        }
        case "delete": {
          if (view.selection.length > 0) {
            const names = diagram.tables
              .filter((table) => view.selection.includes(table.id))
              .map((table) => table.name);
            state.replace(removeTables(diagram, view.selection));
            state.notify(
              names.length === 1
                ? `Eliminaste la tabla ${names[0]}.`
                : `Eliminaste ${names.length} tablas.`,
            );
          } else if (view.selectedRelationId) {
            state.dispatch({
              type: "relation.remove",
              relationId: view.selectedRelationId,
            });
            state.notify("Quitaste la relación.");
          } else return;
          break;
        }
        case "undo":
          state.undo();
          break;
        case "redo":
          state.redo();
          break;
        case "fitView":
          void fitView({ padding: 0.15, maxZoom: 1, duration: fitDuration() });
          break;
        case "toggleCode":
          setView({ codeOpen: !view.codeOpen });
          break;
        case "toggleHelp":
          setView({ helpOpen: !view.helpOpen });
          break;
        case "escape":
          if (view.editingTableId) setView({ editingTableId: null });
          else if (view.helpOpen) setView({ helpOpen: false });
          else if (view.selection.length > 0 || view.selectedRelationId) {
            setView({ selection: [], selectedRelationId: null });
          } else return;
          break;
      }
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addTable, fitView]);
}
