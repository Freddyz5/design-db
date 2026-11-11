// Public API of Tables.
export {
  TableSchema,
  createTable,
  getColumn,
  isUniqueKey,
  patchTable,
} from "./domain/Table";
export type { Table, TablePatch } from "./domain/Table";
export {
  addColumn,
  moveColumn,
  removeColumn,
  updateColumn,
} from "./domain/TableColumns";
