import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";

/**
 * A panel that opens under a button: it closes with a click outside or with
 * Escape, and sits fixed under the button so nothing clips it. `box` wraps the
 * button (and the panel, when it is drawn inside it); a panel drawn in a
 * portal also takes `panel`, so a click on it is not a click outside.
 * `align` says which edge of the button the panel lines up with; `width`,
 * the panel's width, keeps it inside the window on a narrow screen.
 */
export function usePopover(align: "left" | "right" = "left", width = 0) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<CSSProperties>({});

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!box.current?.contains(target) && !panel.current?.contains(target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  /** Opens the panel under `button`, or closes it when it is open. */
  const toggle = useCallback(
    (button: HTMLElement) => {
      if (open) {
        setOpen(false);
        return;
      }
      const rect = button.getBoundingClientRect();
      const room = Math.max(8, window.innerWidth - 8 - width);
      const within = (value: number) => Math.min(room, Math.max(8, value));
      setPlace(
        align === "left"
          ? { top: rect.bottom + 4, left: within(rect.left) }
          : {
              top: rect.bottom + 4,
              right: within(window.innerWidth - rect.right),
            },
      );
      setOpen(true);
    },
    [open, align, width],
  );

  return { open, setOpen, box, panel, place, toggle };
}
