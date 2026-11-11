import type { RefAction } from "../../Relations";
import type { Dialect } from "../../shared";
import {
  draftColumn,
  emptyDraft,
  type DraftColumn,
  type DraftRef,
  type DraftTable,
  type ImportIssue,
  type SchemaDraft,
} from "./SchemaDraft";

/**
 * Reads the common part of DBML: Project (database_type), Table (columns,
 * settings, indexes with pk/unique, Note), Ref (short, long and inline),
 * Enum and TableGroup. Sticky notes and records are skipped.
 */
export function readDbml(text: string): {
  draft?: SchemaDraft;
  errors: ImportIssue[];
  warnings: ImportIssue[];
} {
  const lexed = tokenize(text);
  if ("error" in lexed) return { errors: [lexed.error], warnings: [] };
  const reader = new DbmlReader(lexed.tokens);
  try {
    reader.read();
  } catch (error) {
    if (!(error instanceof DbmlError)) throw error;
    return {
      errors: [{ message: error.message, line: error.line }],
      warnings: reader.warnings,
    };
  }
  return { draft: reader.draft, errors: [], warnings: reader.warnings };
}

// --- Tokens ---------------------------------------------------------------

type Token = {
  kind: "word" | "name" | "string" | "expr" | "number" | "color" | "punct";
  value: string;
  line: number;
};

class DbmlError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
  }
}

function tokenize(text: string): { tokens: Token[] } | { error: ImportIssue } {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  while (i < text.length) {
    const ch = text[i]!;
    const start = line;
    if (ch === "\n") {
      line++;
      i++;
    } else if (/\s/.test(ch)) {
      i++;
    } else if (text.startsWith("//", i)) {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (text.startsWith("/*", i)) {
      const close = text.indexOf("*/", i + 2);
      if (close < 0) return { error: { message: "Unclosed comment", line } };
      line += count(text.slice(i, close), "\n");
      i = close + 2;
    } else if (text.startsWith("'''", i)) {
      const close = text.indexOf("'''", i + 3);
      if (close < 0) return { error: { message: "Unclosed string", line } };
      const value = text.slice(i + 3, close);
      line += count(value, "\n");
      tokens.push({ kind: "string", value: dedent(value), line: start });
      i = close + 3;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      let value = "";
      i++;
      for (;;) {
        if (i >= text.length || (text[i] === "\n" && ch !== "`")) {
          return {
            error: {
              message: ch === '"' ? "Unclosed name" : "Unclosed string",
              line: start,
            },
          };
        }
        const c = text[i]!;
        if (c === "\\" && i + 1 < text.length) {
          const escaped = text[i + 1]!;
          value += escaped === "n" ? "\n" : escaped === "t" ? "\t" : escaped;
          i += 2;
        } else if (c === ch) {
          i++;
          break;
        } else {
          if (c === "\n") line++;
          value += c;
          i++;
        }
      }
      tokens.push({
        kind: ch === "'" ? "string" : ch === '"' ? "name" : "expr",
        value,
        line: start,
      });
    } else if (ch === "#") {
      const from = i++;
      while (i < text.length && /[0-9a-fA-F]/.test(text[i]!)) i++;
      tokens.push({ kind: "color", value: text.slice(from, i), line });
    } else if (/[0-9]/.test(ch)) {
      const from = i;
      while (i < text.length && /[0-9.]/.test(text[i]!)) i++;
      tokens.push({ kind: "number", value: text.slice(from, i), line });
    } else if (/[\p{L}_]/u.test(ch)) {
      const from = i;
      while (i < text.length && /[\p{L}\p{N}_]/u.test(text[i]!)) i++;
      tokens.push({ kind: "word", value: text.slice(from, i), line });
    } else {
      const value = text.startsWith("<>", i) ? "<>" : ch;
      tokens.push({ kind: "punct", value, line });
      i += value.length;
    }
  }
  return { tokens };
}

// --- Reader ---------------------------------------------------------------

const DIALECTS: Record<string, Dialect> = {
  postgresql: "postgres",
  postgres: "postgres",
  mysql: "mysql",
  sqlite: "sqlite",
};

class DbmlReader {
  readonly draft = emptyDraft();
  readonly warnings: ImportIssue[] = [];
  private i = 0;

  constructor(private readonly tokens: Token[]) {}

  read(): void {
    while (!this.done()) {
      const t = this.peek()!;
      if (this.word("project")) this.project();
      else if (this.word("table")) this.table();
      else if (this.word("ref")) this.ref();
      else if (this.word("enum")) this.enumBlock();
      else if (this.word("tablegroup")) this.tableGroup();
      else if (this.word("note", "records", "tablepartial")) {
        this.skipUntil("{");
        this.skipBlock();
      } else throw this.error(`Unexpected "${t.value}"`, undefined, t.line);
    }
  }

  // Project name { database_type: '…' Note: '…' }
  private project(): void {
    if (!this.peekPunct("{")) this.draft.name = this.name("project name");
    this.expectPunct("{");
    while (!this.punct("}")) {
      const key = this.next();
      if (!key) throw this.error("Missing }");
      if (this.punct(":")) {
        const value = this.value();
        if (key.value.toLowerCase() === "database_type") {
          const dialect = DIALECTS[value.toLowerCase()];
          if (dialect) this.draft.dialect = dialect;
        }
      } else if (this.peekPunct("{")) this.skipBlock();
    }
  }

  // Table name [as alias] [settings] { … }
  private table(): void {
    const line = this.line();
    const table: DraftTable = {
      name: this.qualifiedName("table name").at(-1)!,
      columns: [],
      line,
    };
    if (this.word("as")) this.name("alias");
    this.settings();
    this.expectPunct("{");
    while (!this.punct("}")) {
      if (this.done())
        throw this.error("Missing } at the end of the table", undefined, line);
      if (
        this.peekWord("note") &&
        (this.peekPunct(":", 1) || this.peekPunct("{", 1))
      ) {
        this.next();
        table.comment = this.note();
      } else if (this.peekWord("indexes") && this.peekPunct("{", 1)) {
        this.next();
        this.indexes(table);
      } else table.columns.push(this.column(table));
    }
    this.draft.tables.push(table);
  }

  private column(table: DraftTable): DraftColumn {
    const line = this.line();
    const column = draftColumn(this.name("column name"));
    column.type = this.type();
    for (const [key, value] of this.settings()) {
      switch (key) {
        case "pk":
        case "primary key":
          column.primaryKey = true;
          column.nullable = false;
          break;
        case "increment":
          column.autoIncrement = true;
          break;
        case "unique":
          column.unique = true;
          break;
        case "not null":
          column.nullable = false;
          break;
        case "null":
          column.nullable = true;
          break;
        case "default":
          if (value) column.default = value.sql;
          break;
        case "note":
          if (value) column.comment = value.text;
          break;
        case "ref":
          if (value?.ref)
            this.inlineRef(table.name, column.name, value.ref, line);
          break;
      }
    }
    return column;
  }

  /** `int`, `varchar(255)`, `decimal(10,2)`, `"double precision"`. */
  private type(): string {
    const t = this.next();
    if (t?.kind !== "word" && t?.kind !== "name")
      throw this.error("Expected a column type", t);
    let type = t.value;
    if (this.punct(".")) type = this.name("type");
    if (this.punct("(")) {
      const args: string[] = [];
      while (!this.punct(")")) {
        const a = this.next();
        if (!a) throw this.error("Missing )");
        if (a.value !== ",") args.push(a.value);
      }
      type += `(${args.join(",")})`;
    }
    return type;
  }

  // indexes { (a, b) [pk]  col [unique]  … }
  private indexes(table: DraftTable): void {
    this.expectPunct("{");
    while (!this.punct("}")) {
      if (this.done()) throw this.error("Missing } at the end of indexes");
      const line = this.line();
      let columns: string[] = [];
      if (this.punct("(")) {
        while (!this.punct(")")) {
          const t = this.next();
          if (!t) throw this.error("Missing )");
          if (t.kind === "word" || t.kind === "name") columns.push(t.value);
        }
      } else {
        const t = this.next()!;
        if (t.kind === "word" || t.kind === "name") columns = [t.value];
      }
      const settings = new Map(this.settings());
      if (settings.has("pk") || settings.has("primary key"))
        table.primaryKey = columns;
      else if (settings.has("unique")) {
        if (columns.length === 1) {
          const column = table.columns.find((c) => same(c.name, columns[0]!));
          if (column) column.unique = true;
        } else {
          this.warnings.push({
            message: `Unique index on several columns in "${table.name}" was ignored`,
            line,
          });
        }
      }
    }
  }

  // Ref [name]: a.b > c.d [settings]  |  Ref [name] { a.b > c.d [settings] … }
  private ref(): void {
    const name =
      this.peekPunct(":") || this.peekPunct("{")
        ? undefined
        : this.name("ref name");
    if (this.punct(":")) {
      this.refLine(name);
      return;
    }
    this.expectPunct("{");
    while (!this.punct("}")) {
      if (this.done()) throw this.error("Missing } at the end of the ref");
      this.refLine(name);
    }
  }

  private refLine(name: string | undefined): void {
    const line = this.line();
    const left = this.endpoint();
    const op = this.next();
    if (op?.kind !== "punct" || !["<", ">", "-", "<>"].includes(op.value)) {
      throw this.error("Expected <, >, - or <>", op);
    }
    const right = this.endpoint();
    const actions = this.refActions(new Map(this.settings()));
    this.addRef(
      left,
      op.value,
      right,
      { ...actions, ...(name ? { name } : {}) },
      line,
    );
  }

  /** `ref: > table.column` inside a column's settings. */
  private inlineRef(
    table: string,
    column: string,
    ref: { op: string; endpoint: Endpoint },
    line: number,
  ): void {
    this.addRef({ table, columns: [column] }, ref.op, ref.endpoint, {}, line);
  }

  private addRef(
    left: Endpoint,
    op: string,
    right: Endpoint,
    extra: Pick<DraftRef, "name" | "onDelete" | "onUpdate">,
    line: number,
  ): void {
    const [child, parent] = op === "<" ? [right, left] : [left, right];
    this.draft.refs.push({
      fromTable: child.table,
      fromColumns: child.columns,
      toTable: parent.table,
      toColumns: parent.columns,
      kind:
        op === "<>"
          ? "many-to-many"
          : op === "-"
            ? "one-to-one"
            : "many-to-one",
      line,
      ...extra,
    });
  }

  private refActions(
    settings: Map<string, Value | undefined>,
  ): Pick<DraftRef, "onDelete" | "onUpdate"> {
    const result: Pick<DraftRef, "onDelete" | "onUpdate"> = {};
    const onDelete = toAction(settings.get("delete")?.text);
    const onUpdate = toAction(settings.get("update")?.text);
    if (onDelete) result.onDelete = onDelete;
    if (onUpdate) result.onUpdate = onUpdate;
    return result;
  }

  /** `table.column`, `schema.table.column` or `table.(a, b)`. */
  private endpoint(): Endpoint {
    const parts = [this.name("table name")];
    while (this.punct(".")) {
      if (this.punct("(")) {
        const columns: string[] = [];
        while (!this.punct(")")) {
          const t = this.next();
          if (!t) throw this.error("Missing )");
          if (t.kind === "word" || t.kind === "name") columns.push(t.value);
        }
        return { table: parts.at(-1)!, columns };
      }
      parts.push(this.name("column name"));
    }
    if (parts.length < 2) throw this.error("Expected table.column");
    return { table: parts.at(-2)!, columns: [parts.at(-1)!] };
  }

  // Enum name { value [note: '…'] … }
  private enumBlock(): void {
    const name = this.qualifiedName("enum name").at(-1)!;
    this.expectPunct("{");
    const values: string[] = [];
    let note: string | undefined;
    while (!this.punct("}")) {
      if (this.done()) throw this.error("Missing } at the end of the enum");
      if (this.peekWord("note") && this.peekPunct(":", 1)) {
        this.next();
        note = this.note();
        continue;
      }
      values.push(this.name("enum value"));
      this.settings();
    }
    this.draft.enums.push({ name, values, ...(note ? { note } : {}) });
  }

  // TableGroup name [color: #hex, note: '…'] { table … Note: '…' }
  private tableGroup(): void {
    const line = this.line();
    const name = this.name("group name");
    const settings = new Map(this.settings());
    const color = settings.get("color")?.text;
    let note = settings.get("note")?.text;
    this.expectPunct("{");
    const tables: string[] = [];
    while (!this.punct("}")) {
      if (this.done()) throw this.error("Missing } at the end of the group");
      if (
        this.peekWord("note") &&
        (this.peekPunct(":", 1) || this.peekPunct("{", 1))
      ) {
        this.next();
        note = this.note();
        continue;
      }
      tables.push(this.qualifiedName("table name").at(-1)!);
    }
    this.draft.groups.push({
      name,
      tables,
      line,
      ...(color ? { color } : {}),
      ...(note ? { note } : {}),
    });
  }

  /** `Note: '…'` or `Note { '…' }` (after the word Note). */
  private note(): string {
    if (this.punct(":")) return this.stringValue();
    this.expectPunct("{");
    const text = this.stringValue();
    this.expectPunct("}");
    return text;
  }

  /** `[a, b: c, …]` as [key, value] pairs. Keys are lowercase. */
  private settings(): [string, Value | undefined][] {
    if (!this.punct("[")) return [];
    const result: [string, Value | undefined][] = [];
    while (!this.punct("]")) {
      if (this.done()) throw this.error("Missing ]");
      if (this.punct(",")) continue;
      const words: string[] = [];
      while (this.peek()?.kind === "word" && !this.peekPunct(":", 0)) {
        words.push(this.next()!.value.toLowerCase());
        if (this.peekPunct(":") || this.peekPunct(",") || this.peekPunct("]"))
          break;
      }
      const key = words.join(" ");
      if (!key) throw this.error("Expected a setting", this.peek());
      if (!this.punct(":")) {
        result.push([key, undefined]);
        continue;
      }
      if (key === "ref") {
        const op = this.next();
        if (op?.kind !== "punct" || !["<", ">", "-", "<>"].includes(op.value)) {
          throw this.error("Expected <, >, - or <>", op);
        }
        result.push([
          key,
          {
            text: "",
            sql: "",
            ref: { op: op.value, endpoint: this.endpoint() },
          },
        ]);
      } else result.push([key, this.settingValue()]);
    }
    return result;
  }

  /** A setting value, as text and as SQL (for defaults). */
  private settingValue(): Value {
    const t = this.next();
    if (!t) throw this.error("Expected a value");
    if (
      t.kind === "punct" &&
      t.value === "-" &&
      this.peek()?.kind === "number"
    ) {
      const n = `-${this.next()!.value}`;
      return { text: n, sql: n };
    }
    switch (t.kind) {
      case "string":
        return { text: t.value, sql: `'${t.value.replaceAll("'", "''")}'` };
      case "expr":
      case "number":
      case "color":
        return { text: t.value, sql: t.value };
      case "word": {
        // Multi-word values such as `no action` or `set null`.
        let text = t.value;
        while (this.peek()?.kind === "word" && !this.peekPunct(":", 1))
          text += ` ${this.next()!.value}`;
        return { text, sql: text };
      }
      default:
        throw this.error("Expected a value", t);
    }
  }

  private value(): string {
    const t = this.next();
    if (!t) throw this.error("Expected a value");
    return t.value;
  }

  private stringValue(): string {
    const t = this.next();
    if (t?.kind !== "string") throw this.error("Expected a quoted string", t);
    return t.value;
  }

  private qualifiedName(what: string): string[] {
    const parts = [this.name(what)];
    while (this.peekPunct(".") && !this.peekPunct("(", 1)) {
      this.next();
      parts.push(this.name(what));
    }
    return parts;
  }

  private name(what: string): string {
    const t = this.next();
    if (t?.kind === "word" || t?.kind === "name" || t?.kind === "string")
      return t.value;
    throw this.error(`Expected ${what}`, t);
  }

  private skipUntil(value: string): void {
    while (!this.done() && !this.peekPunct(value)) this.next();
  }

  private skipBlock(): void {
    this.expectPunct("{");
    let depth = 1;
    while (depth > 0) {
      const t = this.next();
      if (!t) throw this.error("Missing }");
      if (t.kind === "punct" && t.value === "{") depth++;
      if (t.kind === "punct" && t.value === "}") depth--;
    }
  }

  private done(): boolean {
    return this.i >= this.tokens.length;
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.i + offset];
  }

  private next(): Token | undefined {
    return this.tokens[this.i++];
  }

  private line(): number {
    return (this.peek() ?? this.tokens.at(-1))?.line ?? 1;
  }

  private word(...words: string[]): boolean {
    if (!this.peekWord(...words)) return false;
    this.i++;
    return true;
  }

  private peekWord(...words: string[]): boolean {
    const t = this.peek();
    return t?.kind === "word" && words.includes(t.value.toLowerCase());
  }

  private peekPunct(value: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t?.kind === "punct" && t.value === value;
  }

  private punct(value: string): boolean {
    if (!this.peekPunct(value)) return false;
    this.i++;
    return true;
  }

  private expectPunct(value: string): void {
    if (!this.punct(value)) throw this.error(`Expected ${value}`, this.peek());
  }

  private error(message: string, token?: Token, line?: number): DbmlError {
    const found = token ? ` but found "${token.value}"` : "";
    return new DbmlError(
      `${message}${found}`,
      line ?? token?.line ?? this.line(),
    );
  }
}

type Endpoint = { table: string; columns: string[] };
type Value = {
  text: string;
  sql: string;
  ref?: { op: string; endpoint: Endpoint };
};

function toAction(text: string | undefined): RefAction | undefined {
  switch (text?.toLowerCase()) {
    case "cascade":
      return "cascade";
    case "restrict":
      return "restrict";
    case "set null":
      return "set null";
    case "no action":
    case "set default":
      return "no action";
    default:
      return undefined;
  }
}

/** Removes the common indentation of a multi-line string. */
function dedent(text: string): string {
  const lines = text
    .replace(/^\n/, "")
    .replace(/\n\s*$/, "")
    .split("\n");
  const indent = Math.min(
    ...lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length),
  );
  return lines
    .map((l) => l.slice(Number.isFinite(indent) ? indent : 0))
    .join("\n");
}

function same(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function count(text: string, ch: string): number {
  return text.split(ch).length - 1;
}
