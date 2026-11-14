import type { Diagram } from "@design-db/core";
import { fileBaseName } from "./codeFormats";

/**
 * The whole diagram as a file: the same JSON that is saved, with its
 * version, so the import dialog reads it back as it is.
 */
export function projectFile(diagram: Diagram): { name: string; text: string } {
  return {
    name: `${fileBaseName(diagram)}.design-db.json`,
    text: `${JSON.stringify(diagram, null, 2)}\n`,
  };
}
