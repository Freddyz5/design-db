import { useState } from "react";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";

/** The name a diagram gets when its name is left empty. */
const UNTITLED = "Sin título";

/**
 * The name of the diagram, editable in the bar. Enter or leaving the field
 * saves it as one step to undo; Escape puts the old name back.
 */
export function DiagramName() {
  const name = useEditorStore((state) => selectDiagram(state).name);
  // Only while the user types; otherwise the field shows the diagram's name.
  const [draft, setDraft] = useState<string | null>(null);

  const save = () => {
    if (draft === null) return;
    const next = draft.trim() || UNTITLED;
    setDraft(null);
    if (next !== name) {
      editorStore
        .getState()
        .dispatch({ type: "diagram.update", patch: { name: next } });
    }
  };

  return (
    <input
      className="max-w-60 min-w-12 flex-none truncate rounded-control bg-frame-well px-2.5 py-1 font-display text-[15px] font-semibold tracking-wide text-frame-ink [field-sizing:content] focus-visible:outline-2 focus-visible:outline-lamp max-[560px]:max-w-28"
      aria-label="Nombre del diagrama"
      title={name}
      spellCheck={false}
      autoComplete="off"
      value={draft ?? name}
      onFocus={(event) => {
        setDraft(name);
        event.target.select();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          setDraft(null);
          // Back to the old name, and out of the field without saving.
          requestAnimationFrame(() =>
            (event.target as HTMLInputElement).blur(),
          );
        }
      }}
    />
  );
}
