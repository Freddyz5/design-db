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
  patchDiagram,
} from "./domain/Diagram";
export type {
  Base,
  Diagram,
  DiagramPatch,
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
export { searchTables } from "./domain/DiagramSearch";
export type { SearchMatch, SearchResult } from "./domain/DiagramSearch";
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
