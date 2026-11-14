import type { Id } from "../../shared";
import type { Diagram } from "./Diagram";

/** What the list of saved diagrams shows about each one, without loading it whole. */
export type DiagramSummary = {
  id: Id;
  name: string;
  tableCount: number;
  /** ISO date of the last save. */
  updatedAt: string;
};

/**
 * Where diagrams are kept. The editor only talks to this port, so the engine
 * behind it (SQLite in the browser today) can change without touching it.
 */
export interface DiagramRepository {
  /** Every saved diagram, the most recently edited first. */
  list(): Promise<DiagramSummary[]>;
  /** The saved diagram, or null if there is none with that id. */
  load(id: Id): Promise<Diagram | null>;
  /** Saves the diagram, creating it or replacing the one with its id. */
  save(diagram: Diagram, updatedAt?: string): Promise<DiagramSummary>;
  /** Removes the diagram. Removing one that is not there does nothing. */
  remove(id: Id): Promise<void>;
}

/** The summary of a diagram saved at `updatedAt`. */
export function summarizeDiagram(
  diagram: Diagram,
  updatedAt: string,
): DiagramSummary {
  return {
    id: diagram.id,
    name: diagram.name,
    tableCount: diagram.tables.length,
    updatedAt,
  };
}
