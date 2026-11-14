import { useCallback, useEffect, useState } from "react";
import { readStoredTheme, saveTheme, type Theme } from "../utils/theme";

/** The chosen theme and a way to change it. Starts as `system` until the stored value is read. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    setTheme(readStoredTheme());
  }, []);

  const change = useCallback((next: Theme) => {
    saveTheme(next);
    setTheme(next);
  }, []);

  return [theme, change];
}
