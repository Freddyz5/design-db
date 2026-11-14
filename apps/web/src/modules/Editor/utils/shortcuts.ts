/** What a key can do in the editor. */
export type ShortcutAction =
  | "newTable"
  | "editTable"
  | "delete"
  | "undo"
  | "redo"
  | "fitView"
  | "toggleCode"
  | "toggleHelp"
  | "escape"
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "selectAll";

/** Where an arrow key moves the selected tables: one step left, right, up or down. */
export type Nudge = { dx: -1 | 0 | 1; dy: -1 | 0 | 1 };

/** How far an arrow moves the selection; with Shift, further. */
export const NUDGE_STEP = 10;
export const NUDGE_STEP_FAR = 40;

const ARROWS: Record<string, Nudge> = {
  ArrowLeft: { dx: -1, dy: 0 },
  ArrowRight: { dx: 1, dy: 0 },
  ArrowUp: { dx: 0, dy: -1 },
  ArrowDown: { dx: 0, dy: 1 },
};

/** The way an arrow key moves the selection, or null for any other key. Shift goes further; other modifiers do nothing. */
export function nudgeFor(press: KeyPress): Nudge | null {
  if (press.ctrlKey || press.metaKey || press.altKey) return null;
  return ARROWS[press.key] ?? null;
}

/** The parts of a key event the shortcuts look at. */
export type KeyPress = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
};

/**
 * The action of a key press, or null. Ctrl and Cmd count the same, so the
 * shortcuts work on every system. "/" belongs to the table search.
 */
export function shortcutFor(press: KeyPress): ShortcutAction | null {
  const command = press.ctrlKey || press.metaKey;
  const key = press.key.toLowerCase();
  if (press.altKey) return null;

  if (command) {
    if (key === "z") return press.shiftKey ? "redo" : "undo";
    if (key === "y") return "redo";
    if (key === "a" && !press.shiftKey) return "selectAll";
    return null;
  }
  switch (press.key) {
    // "+" needs Shift on many keyboards; "=" is the same key without it.
    case "+":
    case "=":
      return "zoomIn";
    case "-":
      return "zoomOut";
    case "0":
      return "zoomReset";
    case "Delete":
    case "Backspace":
      return "delete";
    case "Enter":
      return "editTable";
    case "Escape":
      return "escape";
    case "?":
      return "toggleHelp";
  }
  if (press.shiftKey) return null;
  switch (key) {
    case "n":
      return "newTable";
    case "f":
      return "fitView";
    case "c":
      return "toggleCode";
    default:
      return null;
  }
}

/** Whether the key press happened while typing: in a field, in the code, or in a dialog. */
export function isTypingTarget(target: EventTarget | null): boolean {
  return (
    typeof HTMLElement !== "undefined" &&
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select, .cm-editor, dialog") !== null)
  );
}

/** The shortcuts as the help panel lists them. `command` is Ctrl, or ⌘ on a Mac. */
export function shortcutList(
  command: string,
): { keys: string[]; what: string }[] {
  return [
    { keys: ["N"], what: "Nueva tabla" },
    { keys: ["Enter"], what: "Editar la tabla seleccionada" },
    { keys: ["Supr"], what: "Eliminar lo seleccionado" },
    { keys: [command, "Z"], what: "Deshacer" },
    { keys: [command, "Shift", "Z"], what: "Rehacer" },
    { keys: ["F"], what: "Encuadrar la selección, o todo el diagrama" },
    { keys: ["+", "−"], what: "Acercar o alejar" },
    { keys: ["0"], what: "Zoom al 100 %" },
    { keys: [command, "A"], what: "Seleccionar todas las tablas" },
    { keys: ["←↑↓→"], what: "Mover la selección (con Shift, más lejos)" },
    { keys: ["Espacio"], what: "Mantener y arrastrar para mover el lienzo" },
    { keys: ["/"], what: "Buscar una tabla" },
    { keys: ["C"], what: "Mostrar u ocultar el código" },
    { keys: ["?"], what: "Mostrar u ocultar esta ayuda" },
    {
      keys: ["Esc"],
      what: "Soltar la selección y el enfoque, o cerrar el panel",
    },
  ];
}
