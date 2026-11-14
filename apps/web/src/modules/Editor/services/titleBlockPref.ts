const KEY = "design-db:title-block";

/** Whether the user hid the title block, kept in localStorage. Shown when unknown. */
export const titleBlockPref = {
  get(): boolean {
    try {
      return localStorage.getItem(KEY) !== "hidden";
    } catch {
      return true;
    }
  },
  set(open: boolean): void {
    try {
      localStorage.setItem(KEY, open ? "shown" : "hidden");
    } catch {
      // Nothing to do: it shows again on the next visit.
    }
  },
};
