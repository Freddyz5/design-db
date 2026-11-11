import type { Diagram } from "../domain/Diagram";
import { apply, type Op } from "../domain/DiagramOperations";

/**
 * Undo/redo stack. Since operations never modify the previous diagram,
 * undoing is just going back to it.
 */
export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Maximum number of steps kept in `past`. */
  limit: number;
  /** Merge key of the last push. See `push`. */
  lastKey?: string;
};

export const DEFAULT_HISTORY_LIMIT = 100;

export function createHistory<T>(
  present: T,
  options: { limit?: number } = {},
): History<T> {
  return {
    past: [],
    present,
    future: [],
    limit: options.limit ?? DEFAULT_HISTORY_LIMIT,
  };
}

/**
 * Makes `next` the present state and clears the redo stack.
 *
 * When `mergeKey` equals the key of the previous push, `next` replaces the
 * present instead of adding a step. That way, moving the same table
 * several times in a row is undone in one go.
 */
export function push<T>(
  history: History<T>,
  next: T,
  options: { mergeKey?: string } = {},
): History<T> {
  if (next === history.present) return history;
  const { mergeKey } = options;

  if (mergeKey !== undefined && mergeKey === history.lastKey) {
    return { ...history, present: next, future: [] };
  }

  const past = [...history.past, history.present];
  const result: History<T> = {
    past:
      past.length > history.limit
        ? past.slice(past.length - history.limit)
        : past,
    present: next,
    future: [],
    limit: history.limit,
  };
  if (mergeKey !== undefined) result.lastKey = mergeKey;
  return result;
}

/** Stops the next push from merging with the previous one. */
export function checkpoint<T>(history: History<T>): History<T> {
  if (history.lastKey === undefined) return history;
  const { lastKey: _lastKey, ...rest } = history;
  return rest;
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0;
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0;
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1);
  if (!canUndo(history)) return history;
  return {
    past: history.past.slice(0, -1),
    present: previous as T,
    future: [history.present, ...history.future],
    limit: history.limit,
  };
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...future] = history.future;
  if (!canRedo(history)) return history;
  return {
    past: [...history.past, history.present],
    present: next as T,
    future,
    limit: history.limit,
  };
}

/**
 * Applies an operation to the present diagram and records it.
 * Consecutive moves of the same table count as one step.
 */
export function pushOp(history: History<Diagram>, op: Op): History<Diagram> {
  const next = apply(history.present, op);
  if (op.type === "table.move") {
    return push(history, next, { mergeKey: `table.move:${op.tableId}` });
  }
  return push(history, next);
}
