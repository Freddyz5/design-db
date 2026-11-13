import type { IssueCode } from "@design-db/core";

/** What the editor says for each problem the core finds in a diagram. */
export const ISSUE_MESSAGES: Record<IssueCode, string> = {
  "empty-table-name": "Escribe un nombre para la tabla.",
  "duplicate-table-name": "Ya hay otra tabla con este nombre.",
  "empty-column-name": "Escribe un nombre para la columna.",
  "duplicate-column-name": "Ya hay otra columna con este nombre en la tabla.",
  "table-without-primary-key": "La tabla no tiene clave primaria.",
  "nullable-primary-key":
    "Una clave primaria no puede quedar vacía: márcala como obligatoria.",
  "relation-missing-table": "La relación apunta a una tabla que ya no existe.",
  "relation-missing-column": "La relación usa una columna que ya no existe.",
  "relation-column-count":
    "La relación no tiene el mismo número de columnas en los dos lados.",
  "relation-target-not-unique":
    "La columna a la que apunta no es clave primaria ni única.",
  "relation-type-mismatch":
    "El tipo no coincide con el de la columna a la que apunta.",
  "empty-group-name": "Escribe un nombre para el grupo.",
  "duplicate-group-name": "Ya hay otro grupo con este nombre.",
  "table-missing-group": "La tabla está en un grupo que ya no existe.",
  "empty-enum-name": "Escribe un nombre para el enum.",
  "duplicate-enum-name": "Ya hay otro enum con este nombre.",
  "enum-without-values": "El enum no tiene valores.",
  "duplicate-enum-value": "El enum tiene un valor repetido.",
};
