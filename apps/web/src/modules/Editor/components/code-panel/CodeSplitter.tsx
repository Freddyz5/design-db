import type { KeyboardEvent, PointerEvent } from "react";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { clampCodeWidth } from "../../utils/codeFormats";

/** The bar between the canvas and the code: drag it, or use the arrows, to change the width of the code. */
export function CodeSplitter() {
  const width = useEditorStore((state) => state.view.codeWidth);
  const resize = (next: number) =>
    editorStore
      .getState()
      .setView({ codeWidth: clampCodeWidth(next, window.innerWidth) });

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    resize(window.innerWidth - event.clientX);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowLeft: 24, ArrowRight: -24 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    resize(width + step);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Ancho del panel de código"
      aria-valuenow={width}
      tabIndex={0}
      className="relative w-1.5 flex-none cursor-col-resize bg-line hover:bg-lamp-ink focus-visible:bg-lamp-ink focus-visible:outline-none active:bg-lamp-ink max-[900px]:hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    />
  );
}
