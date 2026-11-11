import { z } from "zod";

/**
 * Stable identifier of diagrams, tables, columns and relations.
 * Names can change; ids never do.
 */
export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

export function createId(): Id {
  return crypto.randomUUID();
}
