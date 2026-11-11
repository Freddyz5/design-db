/**
 * Returns a copy of `base` with `patch` merged in. An `undefined` value
 * removes the key when it is listed in `optional`, and is ignored otherwise.
 */
export function applyPatch<T extends object>(
  base: T,
  patch: object,
  optional: readonly string[],
): T {
  const next = { ...base } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value;
    else if (optional.includes(key)) delete next[key];
  }
  return next as T;
}
