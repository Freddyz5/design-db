import { diffDiagram } from "@design-db/core";
import { ChevronDown, Flag, GitCompareArrows } from "lucide-react";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { usePopover } from "../../hooks/usePopover";
import { BarButton } from "./BarButton";

const WHEN = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** When the base was set, as the bar says it. */
export function baseDate(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? at : WHEN.format(date);
}

const ICON = { size: 15, strokeWidth: 1.75, "aria-hidden": true } as const;

const MENU_ITEM =
  "w-full cursor-pointer rounded-[2px] px-2.5 py-1.5 text-left text-[13px] hover:bg-canvas";

const setBase = () => {
  const { dispatch, notify } = editorStore.getState();
  dispatch({ type: "base.set", at: new Date().toISOString() });
  notify("Fijaste la base: los cambios se cuentan desde ahora.");
};

/**
 * The comparison with a base. Without one, a button sets it. With one, the
 * button marks on the canvas what changed since then (with its count), and
 * the arrow beside it opens the base: when it was set, set it again, remove it.
 */
export function ChangesMenu() {
  const at = useEditorStore((state) => selectDiagram(state).base?.at);
  const showChanges = useEditorStore((state) => state.view.showChanges);
  const count = useEditorStore(
    (state) => diffDiagram(selectDiagram(state))?.length ?? 0,
  );
  const { open, setOpen, box, place, toggle } = usePopover("right", 240);

  if (at === undefined) {
    return (
      <BarButton
        compact
        icon={<Flag {...ICON} />}
        title="Fijar base: guardar el esquema de ahora para ver después qué cambió"
        onClick={setBase}
      >
        Fijar base
      </BarButton>
    );
  }

  return (
    <div ref={box} className="relative flex flex-none">
      <BarButton
        icon={<GitCompareArrows {...ICON} />}
        aria-pressed={showChanges}
        title={
          showChanges
            ? "Dejar de marcar los cambios"
            : "Marcar lo nuevo, lo que cambió y lo eliminado desde la base"
        }
        className="rounded-r-none aria-pressed:border-bar-deep aria-pressed:bg-bar-deep aria-pressed:text-bar-active"
        onClick={() =>
          editorStore.getState().setView({ showChanges: !showChanges })
        }
      >
        <span className="max-[1023px]:sr-only">Cambios</span>
        <span className="font-mono text-[11.5px] opacity-80">{count}</span>
      </BarButton>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Base de comparación"
        title={`Base del ${baseDate(at)}`}
        className="-ml-px grid h-[30px] w-6 cursor-pointer place-items-center rounded-r-control border border-bar-line bg-bar-well text-bar-muted hover:border-bar-muted hover:text-bar-ink focus-visible:outline-2 focus-visible:outline-accent"
        onClick={(event) => toggle(event.currentTarget)}
      >
        <ChevronDown size={14} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Base de comparación"
          className="fixed z-30 flex w-60 flex-col rounded-control border border-line bg-raised p-1 text-ink shadow-float"
          style={place}
        >
          <p className="px-2.5 pt-1.5 pb-1 text-[12px] text-ink-muted">
            Base del {baseDate(at)}
          </p>
          <button
            type="button"
            role="menuitem"
            className={MENU_ITEM}
            onClick={() => {
              setBase();
              setOpen(false);
            }}
            autoFocus
          >
            Fijar la base de nuevo
          </button>
          <button
            type="button"
            role="menuitem"
            className={`${MENU_ITEM} text-removed`}
            onClick={() => {
              const { dispatch, setView, notify } = editorStore.getState();
              dispatch({ type: "base.clear" });
              setView({ showChanges: false });
              notify("Quitaste la base.");
              setOpen(false);
            }}
          >
            Quitar la base
          </button>
        </div>
      )}
    </div>
  );
}
