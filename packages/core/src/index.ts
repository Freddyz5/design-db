// Public API of @design-db/core.

// Diagram format
export {
  ColumnSchema,
  DIAGRAM_VERSION,
  DiagramSchema,
  DialectSchema,
  IdSchema,
  LayoutSchema,
  PositionSchema,
  RefActionSchema,
  RelationEndSchema,
  RelationSchema,
  TableLayoutSchema,
  TableSchema,
  ViewportSchema,
  parseDiagram,
} from "./schema";
export type {
  Column,
  Diagram,
  Dialect,
  Id,
  Layout,
  ParseResult,
  Position,
  RefAction,
  Relation,
  RelationEnd,
  Table,
  TableLayout,
  Viewport,
} from "./schema";

// Creating items
export {
  createColumn,
  createDiagram,
  createId,
  createRelation,
  createTable,
} from "./factories";
export { createExampleDiagram } from "./example";

// Editing
export {
  OperationError,
  apply,
  applyAll,
  getColumn,
  getRelation,
  getTable,
} from "./operations";
export type { ColumnPatch, Op, RelationPatch, TablePatch } from "./operations";
export { createManyToMany } from "./many-to-many";

// Reading
export { getCardinality, isUniqueKey } from "./cardinality";
export type { Cardinality } from "./cardinality";
export { validate } from "./validate";
export type { Issue, IssueCode, Severity } from "./validate";

// Undo / redo
export {
  DEFAULT_HISTORY_LIMIT,
  canRedo,
  canUndo,
  checkpoint,
  createHistory,
  push,
  pushOp,
  redo,
  undo,
} from "./history";
export type { History } from "./history";
