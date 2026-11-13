import type { CodeFormat } from "./codeFormats";

/** Where a table is written in the code: lines counted from 0, both ends included. */
export type CodeBlock = { name: string; start: number; end: number };

/** Where to show a table in the code: its block, and the line to put the cursor on. */
export type CodeSpot = { start: number; end: number; line: number };

/** The line that opens a table, with its name in one of the groups. */
const HEADER: Record<CodeFormat, RegExp> = {
  sql: /^\s*CREATE\s+(?:OR\s+REPLACE\s+)?(?:(?:TEMP|TEMPORARY|UNLOGGED)\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"[^"]+"|`[^`]+`|\[[^\]]+\]|[\w$]+)\s*\.\s*)?(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([\w$À-￿]+))/i,
  dbml: /^\s*Table\s+(?:(?:"[^"]+"|[\wÀ-￿]+)\s*\.\s*)?(?:"([^"]+)"|([\wÀ-￿]+))/i,
  drizzle:
    /^\s*(?:export\s+)?const\s+[\w$]+\s*=\s*\w*Table\(\s*["'`]([^"'`]+)["'`]/,
};

/** The brackets a table's body sits in, and how a line comment starts. */
const SYNTAX: Record<
  CodeFormat,
  { open: string; close: string; comment: string }
> = {
  sql: { open: "(", close: ")", comment: "--" },
  dbml: { open: "{", close: "}", comment: "//" },
  drizzle: { open: "(", close: ")", comment: "//" },
};

function headerName(line: string, format: CodeFormat): string | null {
  const match = HEADER[format].exec(line);
  return match
    ? (match.slice(1).find((group) => group !== undefined) ?? null)
    : null;
}

/**
 * The line where the block that opens on `start` closes: where its brackets
 * are balanced again. Brackets inside quotes and comments do not count. A
 * block that never closes ends before the next table, or with the code.
 */
function blockEnd(lines: readonly string[], start: number, format: CodeFormat) {
  const { open, close, comment } = SYNTAX[format];
  let depth = 0;
  let opened = false;
  let quote: string | null = null;
  for (let index = start; index < lines.length; index++) {
    if (index > start && headerName(lines[index]!, format)) return index - 1;
    const line = lines[index]!;
    for (let at = 0; at < line.length; at++) {
      const char = line[at]!;
      if (quote) {
        if (char === "\\") at++;
        else if (char === quote) quote = null;
        continue;
      }
      if (line.startsWith(comment, at)) break;
      if (char === "'" || char === '"' || char === "`") quote = char;
      else if (char === open) {
        depth++;
        opened = true;
      } else if (char === close) {
        depth--;
        if (opened && depth === 0) return index;
      }
    }
  }
  return lines.length - 1;
}

/** Every table written in the code, in order. */
export function tableBlocks(code: string, format: CodeFormat): CodeBlock[] {
  const lines = code.split("\n");
  const blocks: CodeBlock[] = [];
  for (let index = 0; index < lines.length; index++) {
    const name = headerName(lines[index]!, format);
    if (name === null) continue;
    const end = blockEnd(lines, index, format);
    blocks.push({ name, start: index, end });
    index = end;
  }
  return blocks;
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** A name without case or underscores: `created_at` and `createdAt` are the same column. */
const loose = (name: string) => name.toLowerCase().replaceAll("_", "");

/** The name a column line starts with, without its quotes; for Drizzle, its key. */
function columnName(line: string, format: CodeFormat): string | null {
  const match =
    format === "drizzle"
      ? /^\s*["'`]?([\w$]+)["'`]?\s*:/.exec(line)
      : /^\s*["`[]?([^"`\]\s,]+)/.exec(line);
  return match?.[1] ?? null;
}

/**
 * Where a table is in the code, found by its name. With a column, the line
 * of that column; otherwise the line that opens the table.
 */
export function locateTable(
  code: string,
  format: CodeFormat,
  tableName: string,
  column?: string,
): CodeSpot | null {
  const block = tableBlocks(code, format).find((b) => same(b.name, tableName));
  if (!block) return null;
  let line = block.start;
  if (column !== undefined) {
    const lines = code.split("\n");
    for (let index = block.start + 1; index <= block.end; index++) {
      const name = columnName(lines[index]!, format);
      const found =
        name !== null &&
        (format === "drizzle"
          ? loose(name) === loose(column)
          : same(name, column));
      if (found) {
        line = index;
        break;
      }
    }
  }
  return { start: block.start, end: block.end, line };
}

/** The name of the table written on a line of the code, or null outside every table. */
export function tableAtLine(
  code: string,
  format: CodeFormat,
  line: number,
): string | null {
  return (
    tableBlocks(code, format).find((b) => b.start <= line && line <= b.end)
      ?.name ?? null
  );
}
