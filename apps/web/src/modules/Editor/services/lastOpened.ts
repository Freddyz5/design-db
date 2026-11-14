import type { LastOpened } from "../hooks/DiagramStorage";

const KEY = "design-db:last-diagram";

/** The last diagram open, kept in localStorage. Without it (blocked storage) the most recent one opens. */
export const browserLastOpened: LastOpened = {
  get() {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(id) {
    try {
      localStorage.setItem(KEY, id);
    } catch {
      // Nothing to do: next time the most recent diagram opens instead.
    }
  },
};
