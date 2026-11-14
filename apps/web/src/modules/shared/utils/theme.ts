/** `system` follows the preference of the operating system. */
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

/** Where the chosen theme is kept in the browser. `system` is stored as no value. */
export const THEME_STORAGE_KEY = "design-db:theme";

/** Reads a stored value. Anything that is not a theme means `system`. */
export function parseTheme(value: unknown): Theme {
  return THEMES.find((theme) => theme === value) ?? "system";
}

/** The value of `data-theme` on <html> for a theme: none for `system`. */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}

export function readStoredTheme(): Theme {
  try {
    return parseTheme(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // Storage can be blocked; the theme then follows the system.
    return "system";
  }
}

/** Applies the theme to the page and remembers it. */
export function saveTheme(theme: Theme): void {
  const attribute = themeAttribute(theme);
  if (attribute) document.documentElement.dataset.theme = attribute;
  else delete document.documentElement.dataset.theme;

  try {
    if (attribute) localStorage.setItem(THEME_STORAGE_KEY, attribute);
    else localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // The theme still applies to this page; it just won't be remembered.
  }
}
