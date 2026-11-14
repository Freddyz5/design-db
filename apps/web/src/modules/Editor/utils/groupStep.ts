/** A group named as a step of the schema: "Paso 1 · Catálogo" (also step, fase, etapa). */
const STEP = /^(?:paso|step|fase|etapa)\s*(\d+)\s*[·:.\-–—]\s*(.+)$/i;

/** The number and the title of a group named as a step, or null for any other name. */
export function groupStep(
  name: string,
): { number: number; title: string } | null {
  const match = STEP.exec(name.trim());
  if (!match) return null;
  return { number: Number(match[1]), title: match[2]!.trim() };
}
