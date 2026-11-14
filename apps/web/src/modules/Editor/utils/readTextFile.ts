/** The text of a file the user chose or dropped. */
export function readTextFile(file: File): Promise<string> {
  return file.text();
}

/** The files the import accepts. */
export const SCHEMA_FILE_TYPES = ".sql,.dbml,.ts,.js,.json,.txt";
