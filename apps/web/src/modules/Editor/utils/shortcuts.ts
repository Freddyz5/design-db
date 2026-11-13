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
  | "escape";

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
    return null;
  }
  switch (press.key) {
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
    { keys: ["F"], what: "Ver todo el diagrama" },
    { keys: ["/"], what: "Buscar una tabla" },
    { keys: ["C"], what: "Mostrar u ocultar el código" },
    { keys: ["?"], what: "Mostrar u ocultar esta ayuda" },
    { keys: ["Esc"], what: "Quitar la selección o cerrar el panel" },
  ];
}
