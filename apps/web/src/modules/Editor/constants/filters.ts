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
