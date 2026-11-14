import type { SaveStatus } from "../utils/autosave";

/** What the bar says for each save status. Nothing while there is nothing to save. */
export const SAVE_STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "",
  pending: "Guardando…",
  saving: "Guardando…",
  saved: "Guardado",
  error: "No se pudo guardar",
};

export const SAVE_STATUS_TITLE = {
  local: "Guardado solo en este navegador",
  error:
    "No se pudo guardar. Tus cambios siguen aquí; se intentará otra vez con el próximo cambio.",
  transient:
    "Este navegador no permite guardar aquí (¿ventana privada?). Descarga el proyecto para no perderlo.",
} as const;

/** Said instead of the status when the browser cannot keep anything. */
export const NOT_PERSISTENT_TEXT = "Sin guardar";
