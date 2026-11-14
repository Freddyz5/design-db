import { z } from "zod";
import { applyPatch, createId, IdSchema } from "../../shared";

/** A named set of tables, shown together and in the same color. */
export const GroupSchema = z.object({
  id: IdSchema,
  name: z.string(),
  /** Free text: a palette key of the editor or a hex color. */
  color: z.string().optional(),
  /**
   * How strong the color is drawn, as a factor of the editor's default: 1 is
   * the default, less is fainter, more is stronger. Absent means 1.
   */
  intensity: z.number().positive().optional(),
  note: z.string().optional(),
});
export type Group = z.infer<typeof GroupSchema>;

/** `undefined` on an optional field removes it. */
export type GroupPatch = {
  name?: string;
  color?: string | undefined;
  intensity?: number | undefined;
  note?: string | undefined;
};

export function createGroup(init: Partial<Group> = {}): Group {
  const group: Group = {
    id: init.id ?? createId(),
    name: init.name ?? "group",
  };
  if (init.color !== undefined) group.color = init.color;
  if (init.intensity !== undefined) group.intensity = init.intensity;
  if (init.note !== undefined) group.note = init.note;
  return group;
}

/** Returns a copy of the group with the patch applied. */
export function patchGroup(group: Group, patch: GroupPatch): Group {
  return applyPatch(group, patch, ["color", "intensity", "note"]);
}
