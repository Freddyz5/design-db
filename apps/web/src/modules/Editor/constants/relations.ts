import type { RefAction } from "@design-db/core";

/** What the database does with the rows that point at a row that is deleted or changed. */
export const REF_ACTIONS: readonly (readonly [RefAction, string])[] = [
  ["no action", "Sin acción"],
  ["cascade", "En cascada"],
  ["set null", "Dejar en null"],
  ["restrict", "Impedir"],
];
