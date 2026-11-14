import { useEditorStore } from "../../hooks/useEditorStore";
import {
  NOT_PERSISTENT_TEXT,
  SAVE_STATUS_TEXT,
  SAVE_STATUS_TITLE,
} from "../../constants/saveStatus";

/** Whether the diagram is saved: «Guardando…», «Guardado», or what went wrong. */
export function SaveState() {
  const status = useEditorStore((state) => state.view.saveStatus);
  const persistent = useEditorStore((state) => state.view.persistent);

  const transient = persistent === false && status !== "idle";
  const text = transient ? NOT_PERSISTENT_TEXT : SAVE_STATUS_TEXT[status];
  const title = transient
    ? SAVE_STATUS_TITLE.transient
    : status === "error"
      ? SAVE_STATUS_TITLE.error
      : SAVE_STATUS_TITLE.local;
  const danger = transient || status === "error";

  return (
    <span
      role="status"
      title={text ? title : undefined}
      className={`flex-none text-xs whitespace-nowrap max-[720px]:hidden ${danger ? "text-frame-danger" : "text-frame-muted"}`}
    >
      {text}
    </span>
  );
}
