import { useReactFlow } from "@xyflow/react";
import { useEffect } from "react";
import { removeTables } from "../utils/diagramEdits";
import {
  NUDGE_STEP,
  NUDGE_STEP_FAR,
  isTypingTarget,
  nudgeFor,
  shortcutFor,
} from "../utils/shortcuts";
import { selectDiagram } from "./EditorStore";
import { useAddTable } from "./useAddTable";
import { editorStore } from "./useEditorStore";

const fitDuration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 200;

/** How long after the last arrow the moves count as one step to undo. */
const NUDGE_REST = 400;

/** The keyboard shortcuts of the editor. They stay quiet while the user types in a field, the code or a dialog. */
export function useShortcuts(): void {
  const { fitView, zoomIn, zoomOut, zoomTo, getNode } = useReactFlow();
  const addTable = useAddTable();

  // The arrows move the selected tables. They listen first, so the canvas's
  // own arrow moves, which never reach the diagram, do not run as well.
  useEffect(() => {
    let rest: ReturnType<typeof setTimeout> | undefined;
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const nudge = nudgeFor(event);
      const state = editorStore.getState();
      if (!nudge || state.view.selection.length === 0) return;
      event.preventDefault();
      event.stopPropagation();
      const step = event.shiftKey ? NUDGE_STEP_FAR : NUDGE_STEP;
      const positions = Object.fromEntries(
        state.view.selection.flatMap((id) => {
          const at = getNode(id)?.position;
          return at
            ? [
                [
                  id,
                  {
                    x: Math.round(at.x + nudge.dx * step),
                    y: Math.round(at.y + nudge.dy * step),
                  },
                ],
              ]
            : [];
        }),
      );
      // Arrows in a row are one step to undo.
      state.dispatch(
        { type: "layout.place", positions },
        { mergeKey: "nudge" },
      );
      clearTimeout(rest);
      rest = setTimeout(() => editorStore.getState().checkpoint(), NUDGE_REST);
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      clearTimeout(rest);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [getNode]);

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
          // The selection if there is one, else the whole diagram.
          void fitView({
            padding: 0.15,
            maxZoom: 1,
            duration: fitDuration(),
            ...(view.selection.length > 0
              ? { nodes: view.selection.map((id) => ({ id })) }
              : {}),
          });
          break;
        case "zoomIn":
          void zoomIn({ duration: fitDuration() });
          break;
        case "zoomOut":
          void zoomOut({ duration: fitDuration() });
          break;
        case "zoomReset":
          void zoomTo(1, { duration: fitDuration() });
          break;
        case "selectAll":
          setView({ selection: diagram.tables.map((table) => table.id) });
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
          else if (
            view.selection.length > 0 ||
            view.selectedRelationId ||
            view.pinnedTableId
          ) {
            setView({
              selection: [],
              selectedRelationId: null,
              pinnedTableId: null,
            });
          } else return;
          break;
      }
      event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [addTable, fitView, zoomIn, zoomOut, zoomTo]);
}
