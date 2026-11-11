/** Base class for the errors raised by the domain. */
export class DomainError extends Error {
  override name = "DomainError";
}

/**
 * Thrown when a change cannot be applied, e.g. it points at a table that
 * does not exist. Changes keep ids consistent; problems such as duplicate
 * names are reported by `validate` instead.
 */
export class OperationError extends DomainError {
  override name = "OperationError";
}
