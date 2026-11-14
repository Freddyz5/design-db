import type { DiagramSummary } from "@design-db/core";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { selectDiagram } from "../../hooks/EditorStore";
import { getDiagramStorage } from "../../hooks/useDiagramStorage";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { downloadText } from "../../utils/downloadText";
import { projectFile } from "../../utils/projectFile";
import { savedAt } from "../../utils/savedAt";

const MENU_ITEM =
  "flex w-full cursor-pointer items-baseline gap-3 rounded-[2px] px-2.5 py-1.5 text-left text-[13px] hover:bg-canvas";
const MENU_NOTE = "px-2.5 py-1.5 text-[12px] text-ink-muted";

/** Puts the cursor in the diagram's name, as after starting a new diagram. */
export function focusDiagramName(): void {
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLInputElement>(
        'input[aria-label="Nombre del diagrama"]',
      )
      ?.focus(),
  );
}

/** Starts an empty diagram, saved and ready to be named. */
export async function startNewDiagram(): Promise<void> {
  await getDiagramStorage().create();
  focusDiagramName();
}

/**
 * «Mis diagramas»: the arrow by the name opens the saved diagrams to switch
 * between them, and the actions on the one open: new, duplicate, delete.
 */
export function DiagramsMenu() {
  const currentId = useEditorStore((state) => selectDiagram(state).id);
  const currentName = useEditorStore((state) => selectDiagram(state).name);
  const persistent = useEditorStore((state) => state.view.persistent);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DiagramSummary[] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const show = (button: HTMLElement) => {
    const rect = button.getBoundingClientRect();
    setPlace({ top: rect.bottom + 4, left: Math.max(8, rect.left - 200) });
    setItems(null);
    setConfirming(false);
    setOpen(true);
    getDiagramStorage()
      .list()
      .then(setItems, () => setItems([]));
  };

  /** Closes the menu, then does the action. */
  const act = (action: () => Promise<void>) => () => {
    setOpen(false);
    void action();
  };

  const remove = async () => {
    const name = currentName;
    await getDiagramStorage().removeCurrent();
    editorStore.getState().notify(`Eliminaste «${name}».`);
  };

  return (
    <div ref={box} className="relative flex-none">
      <button
        type="button"
        className="grid size-7 cursor-pointer place-items-center rounded-control text-bar-muted hover:bg-bar-well hover:text-bar-ink focus-visible:outline-2 focus-visible:outline-accent"
        aria-label="Mis diagramas"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Mis diagramas"
        onClick={(event) => (open ? setOpen(false) : show(event.currentTarget))}
      >
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Mis diagramas"
          className="fixed z-30 flex max-h-[70vh] w-[min(340px,calc(100vw-16px))] flex-col overflow-auto rounded-control border border-line bg-raised p-1 text-ink shadow-float"
          style={place}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          <h2 className="px-2.5 pt-1.5 pb-1 font-display text-[11px] font-semibold tracking-[0.12em] text-ink-muted uppercase">
            Mis diagramas
          </h2>
          {items === null && <p className={MENU_NOTE}>Cargando…</p>}
          {items?.length === 0 && (
            <p className={MENU_NOTE}>Aún no hay diagramas guardados.</p>
          )}
          {items?.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className={`${MENU_ITEM} ${item.id === currentId ? "font-semibold" : ""}`}
              aria-current={item.id === currentId ? "true" : undefined}
              onClick={act(() => getDiagramStorage().openSaved(item.id))}
            >
              <span className="min-w-0 flex-1 truncate">{item.name}</span>
              <small className="flex-none text-[11.5px] font-normal whitespace-nowrap text-ink-muted tabular-nums">
                {item.tableCount} {item.tableCount === 1 ? "tabla" : "tablas"} ·{" "}
                {savedAt(item.updatedAt)}
              </small>
            </button>
          ))}
          <hr className="my-1 border-line" />
          <button
            type="button"
            role="menuitem"
            className={MENU_ITEM}
            onClick={act(startNewDiagram)}
          >
            Nuevo diagrama
          </button>
          <button
            type="button"
            role="menuitem"
            className={MENU_ITEM}
            onClick={act(() => getDiagramStorage().duplicate())}
          >
            Duplicar este diagrama
          </button>
          <button
            type="button"
            role="menuitem"
            className={MENU_ITEM}
            title="El diagrama completo como archivo; se abre otra vez con Importar"
            onClick={act(async () => {
              const file = projectFile(selectDiagram(editorStore.getState()));
              downloadText(file.name, file.text, "application/json");
            })}
          >
            Descargar proyecto (.json)
          </button>
          {confirming ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-removed">
              <span className="min-w-0 flex-1 truncate">
                ¿Eliminar «{currentName}»?
              </span>
              <button
                type="button"
                className="h-7 cursor-pointer rounded-control bg-removed px-2.5 font-semibold text-raised"
                onClick={act(remove)}
                autoFocus
              >
                Eliminar
              </button>
              <button
                type="button"
                className="h-7 cursor-pointer rounded-control border border-line px-2.5 text-ink"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              role="menuitem"
              className={`${MENU_ITEM} text-removed`}
              onClick={() => setConfirming(true)}
            >
              Eliminar este diagrama
            </button>
          )}
          <p className={MENU_NOTE}>
            {persistent === false
              ? "Este navegador no permite guardar aquí: descarga el proyecto para no perderlo."
              : "Se guarda solo en este navegador."}
          </p>
        </div>
      )}
    </div>
  );
}
