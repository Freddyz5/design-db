import type { ColumnsFilter, RelationsFilter } from "../utils/canvasElements";

export const COLUMNS_FILTERS: readonly {
  value: ColumnsFilter;
  label: string;
  title: string;
}[] = [
  { value: "all", label: "Todo", title: "Todas las columnas" },
  {
    value: "keys",
    label: "Claves",
    title: "Solo claves primarias, foráneas y únicas",
  },
  { value: "name", label: "Nombre", title: "Solo el nombre de la tabla" },
];

export const RELATIONS_FILTERS: readonly {
  value: RelationsFilter;
  label: string;
  title: string;
}[] = [
  { value: "all", label: "Todas", title: "Todas las relaciones" },
  {
    value: "group",
    label: "Grupo",
    title:
      "Solo las relaciones dentro de cada grupo; las demás aparecen al seleccionar una tabla",
  },
  {
    value: "focus",
    label: "Enfoque",
    title: "Solo las relaciones de las tablas seleccionadas",
  },
];

/** The themes, as the «Vista» panel offers them on a narrow screen. */
export const THEME_OPTIONS: readonly {
  value: "light" | "dark" | "system";
  label: string;
  title: string;
}[] = [
  { value: "light", label: "Claro", title: "Tinta sobre papel" },
  {
    value: "dark",
    label: "Oscuro",
    title: "La misma tinta sobre una hoja oscura",
  },
  { value: "system", label: "Del sistema", title: "Como lo tenga el sistema" },
];
