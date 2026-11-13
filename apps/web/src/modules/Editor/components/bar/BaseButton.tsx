import { Flag } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { editorStore } from "../../hooks/useEditorStore";
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

const MENU_ITEM =
  "w-full cursor-pointer rounded-[2px] px-2.5 py-1.5 text-left text-[13px] hover:bg-canvas";

/**
 * Sets the base: a copy of the schema to compare with later. Once there is
 * one, the button shows its date and opens a menu to set it again or remove it.
 */
export function BaseButton({ at }: { at: string | undefined }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  /** Where the menu goes: under the button, fixed, so the scrolling bar does not clip it. */
  const [place, setPlace] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const set = () => {
    const { dispatch, notify } = editorStore.getState();
    dispatch({ type: "base.set", at: new Date().toISOString() });
    notify("Fijaste la base: los cambios se cuentan desde ahora.");
    setOpen(false);
  };

  if (at === undefined) {
    return (
      <BarButton
        icon={<Flag size={15} strokeWidth={1.75} aria-hidden />}
        title="Guardar el esquema de ahora para compararlo después"
        onClick={set}
      >
        Fijar base
      </BarButton>
    );
  }

  return (
    <div ref={box} className="relative flex-none">
      <BarButton
        icon={<Flag size={15} strokeWidth={1.75} aria-hidden />}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Base de comparación"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPlace({ top: rect.bottom + 4, left: rect.left });
          setOpen((value) => !value);
        }}
      >
        Base<span className="max-[1439px]:sr-only"> · {baseDate(at)}</span>
      </BarButton>
      {open && (
        <div
          role="menu"
          className="fixed z-30 flex w-56 flex-col rounded-control border border-line bg-raised p-1 text-ink shadow-float"
          style={place}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <button
            type="button"
            role="menuitem"
            className={MENU_ITEM}
            onClick={set}
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
