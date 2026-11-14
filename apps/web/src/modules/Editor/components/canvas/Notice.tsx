import { Panel } from "@xyflow/react";
import { useEffect } from "react";
import { selectCanUndo } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";

/** How long a notice stays before it goes away by itself. */
const NOTICE_MS = 8000;

/** Says what the last change was and lets the user undo it. */
export function Notice() {
  const notice = useEditorStore((state) => state.view.notice);
  // After opening another diagram (a deletion) there is nothing to undo.
  const canUndo = useEditorStore(selectCanUndo);

  useEffect(() => {
    if (notice === null) return;
    const timer = setTimeout(
      () => editorStore.getState().setView({ notice: null }),
      NOTICE_MS,
    );
    return () => clearTimeout(timer);
  }, [notice]);

  // Above the row of the zoom bar, which can be wide with the changes counted.
  return (
    <Panel position="bottom-center" className="!mb-14">
      <div role="status">
        {notice !== null && (
          <div className="flex items-center gap-3 rounded-control bg-bar py-1.5 pr-1.5 pl-3.5 text-[13px] text-bar-ink shadow-float">
            {notice}
            {canUndo && (
              <button
                type="button"
                className="h-7 cursor-pointer rounded-[2px] px-2.5 font-semibold text-accent hover:bg-bar-well focus-visible:outline-accent"
                onClick={() => editorStore.getState().undo()}
              >
                Deshacer
              </button>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}
