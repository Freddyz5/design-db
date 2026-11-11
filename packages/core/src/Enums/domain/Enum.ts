import { z } from "zod";
import { applyPatch, createId, IdSchema } from "../../shared";

/**
 * A list of allowed values. A column uses it by having the enum's name as
 * its `type` (compared ignoring case).
 */
export const EnumSchema = z.object({
  id: IdSchema,
  name: z.string(),
  values: z.array(z.string()),
  note: z.string().optional(),
});
export type Enum = z.infer<typeof EnumSchema>;

/** `undefined` on an optional field removes it. */
export type EnumPatch = {
  name?: string;
  values?: string[];
  note?: string | undefined;
};

export function createEnum(init: Partial<Enum> = {}): Enum {
  const created: Enum = {
    id: init.id ?? createId(),
    name: init.name ?? "enum",
    values: init.values ?? [],
  };
  if (init.note !== undefined) created.note = init.note;
  return created;
}

/** Returns a copy of the enum with the patch applied. */
export function patchEnum(value: Enum, patch: EnumPatch): Enum {
  return applyPatch(value, patch, ["note"]);
}

/** True if a column type refers to this enum. */
export function isEnumType(value: Enum, type: string): boolean {
  return value.name.trim().toLowerCase() === type.trim().toLowerCase();
}
