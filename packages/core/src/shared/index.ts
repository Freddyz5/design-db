// Public API of shared: what two or more modules use.
export { DialectSchema } from "./domain/Dialect";
export type { Dialect } from "./domain/Dialect";
export { DomainError, OperationError } from "./domain/DomainErrors";
export { IdSchema, createId } from "./domain/Id";
export type { Id } from "./domain/Id";
export { applyPatch } from "./utils/applyPatch";
