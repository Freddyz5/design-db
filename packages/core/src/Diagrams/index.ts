// Public API of Diagrams: domain + application.
export {
  DIAGRAM_VERSION,
  DiagramSchema,
  DialectSchema,
  LayoutSchema,
  PositionSchema,
  TableLayoutSchema,
  ViewportSchema,
  createDiagram,
  getRelation,
  getTable,
  parseDiagram,
} from "./domain/Diagram";
export type {
  Diagram,
  Dialect,
  Layout,
  ParseResult,
  Position,
  TableLayout,
  Viewport,
} from "./domain/Diagram";
export { apply, applyAll } from "./domain/DiagramOperations";
export type { Op, TableUpdatePatch } from "./domain/DiagramOperations";
export { createManyToMany } from "./domain/DiagramManyToMany";
export { validate } from "./domain/DiagramValidation";
export type { Issue, IssueCode, Severity } from "./domain/DiagramValidation";
export * from "./application";
