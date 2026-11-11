// Public API of Diagrams: domain + application.
export {
  BaseSchema,
  DIAGRAM_VERSION,
  DiagramSchema,
  LayoutSchema,
  PositionSchema,
  TableLayoutSchema,
  ViewportSchema,
  createDiagram,
  findEnum,
  getEnum,
  getGroup,
  getRelation,
  getTable,
  parseDiagram,
} from "./domain/Diagram";
export type {
  Base,
  Diagram,
  Layout,
  ParseResult,
  Position,
  TableLayout,
  Viewport,
} from "./domain/Diagram";
export { apply, applyAll } from "./domain/DiagramOperations";
export type { Op, TableUpdatePatch } from "./domain/DiagramOperations";
export { createManyToMany } from "./domain/DiagramManyToMany";
export { mergeDiagram } from "./domain/DiagramMerge";
export { diffDiagram } from "./domain/DiagramDiff";
export type { ChangeKind, DiagramChange } from "./domain/DiagramDiff";
export type { MergeMode } from "./domain/DiagramMerge";
export {
  DEFAULT_LAYOUT_OPTIONS,
  estimateTableSize,
  layoutPositions,
  placementOrigin,
  toLayoutGraph,
  unplacedTableIds,
} from "./domain/DiagramLayout";
export type {
  LayoutEdge,
  LayoutGraph,
  LayoutNode,
  Size,
} from "./domain/DiagramLayout";
export { validate } from "./domain/DiagramValidation";
export type { Issue, IssueCode, Severity } from "./domain/DiagramValidation";
export * from "./application";
