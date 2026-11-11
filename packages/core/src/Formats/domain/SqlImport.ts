import type { RefAction } from "../../Relations";
import type { Dialect } from "../../shared";
import {
  draftColumn,
  emptyDraft,
  type DraftColumn,
  type DraftTable,
  type ImportIssue,
  type SchemaDraft,
} from "./SchemaDraft";

/**
 * Reads the common part of a SQL schema (PostgreSQL or MySQL):
 * CREATE TABLE, ALTER TABLE … ADD (FOREIGN KEY, PRIMARY KEY, UNIQUE,
 * COLUMN), CREATE TYPE … AS ENUM and COMMENT ON. Other statements
 * (indexes, inserts, settings…) are ignored.
 */
export function readSql(text: string): {
  draft?: SchemaDraft;
  errors: ImportIssue[];
  warnings: ImportIssue[];
} {
  const lexed = tokenize(text);
  if ("error" in lexed) return { errors: [lexed.error], warnings: [] };

  const reader = new SqlReader(text);
  const errors: ImportIssue[] = [];
  for (const statement of splitStatements(lexed.tokens)) {
    try {
      reader.statement(statement);
    } catch (error) {
      if (!(error instanceof SqlError)) throw error;
      errors.push({ message: error.message, line: error.line });
    }
  }
  if (errors.length) return { errors, warnings: reader.warnings };
  return {
    draft: reader.finish(lexed.tokens),
    errors,
    warnings: reader.warnings,
  };
}

// --- Tokens ---------------------------------------------------------------

type Token = {
  kind: "word" | "quoted" | "string" | "number" | "punct";
  value: string;
  line: number;
  start: number;
  end: number;
  /** Quoted with backticks (a MySQL sign). */
  backtick?: boolean;
};

class SqlError extends Error {
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
  const push = (
    kind: Token["kind"],
    value: string,
    start: number,
    extra = {},
  ) => tokens.push({ kind, value, line, start, end: i, ...extra });

  while (i < text.length) {
    const ch = text[i]!;
    if (ch === "\n") {
      line++;
      i++;
    } else if (/\s/.test(ch)) {
      i++;
    } else if (text.startsWith("--", i) || ch === "#") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (text.startsWith("/*", i)) {
      const close = text.indexOf("*/", i + 2);
      if (close < 0) return { error: { message: "Unclosed comment", line } };
      line += count(text.slice(i, close), "\n");
      i = close + 2;
    } else if (ch === "'" || ch === '"' || ch === "`") {
      const startLine = line;
      const start = i;
      let value = "";
      i++;
      for (;;) {
        if (i >= text.length) {
          const what = ch === "'" ? "string" : "quoted name";
          return { error: { message: `Unclosed ${what}`, line: startLine } };
        }
        const c = text[i]!;
        if (c === "\\" && ch === "'" && i + 1 < text.length) {
          value += text[i + 1];
          i += 2;
        } else if (c === ch && text[i + 1] === ch) {
          value += ch;
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
        kind: ch === "'" ? "string" : "quoted",
        value,
        line: startLine,
        start,
        end: i,
        ...(ch === "`" ? { backtick: true } : {}),
      });
    } else if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < text.length && /[0-9.]/.test(text[i]!)) i++;
      push("number", text.slice(start, i), start);
    } else if (/[\p{L}_]/u.test(ch)) {
      const start = i;
      while (i < text.length && /[\p{L}\p{N}_$]/u.test(text[i]!)) i++;
      push("word", text.slice(start, i), start);
    } else {
      const start = i;
      i += text.startsWith("::", i) ? 2 : 1;
      push("punct", text.slice(start, i), start);
    }
  }
  return { tokens };
}

function splitStatements(tokens: Token[]): Token[][] {
  const statements: Token[][] = [];
  let current: Token[] = [];
  for (const token of tokens) {
    if (token.kind === "punct" && token.value === ";") {
      if (current.length) statements.push(current);
      current = [];
    } else current.push(token);
  }
  if (current.length) statements.push(current);
  return statements;
}

// --- Reader ---------------------------------------------------------------

/** Words that end a column type and start a column constraint. */
const CONSTRAINT_WORDS = new Set([
  "not",
  "null",
  "primary",
  "unique",
  "default",
  "references",
  "check",
  "constraint",
  "auto_increment",
  "autoincrement",
  "generated",
  "identity",
  "comment",
  "collate",
  "on",
]);

class SqlReader {
  readonly warnings: ImportIssue[] = [];
  private readonly draft = emptyDraft();
  private readonly comments: {
    table: string;
    column?: string;
    text: string;
  }[] = [];

  constructor(private readonly source: string) {}

  statement(tokens: Token[]): void {
    const s = new Cursor(tokens, this.source);
    if (s.word("create")) {
      while (
        s.word(
          "or",
          "replace",
          "temporary",
          "temp",
          "unlogged",
          "global",
          "local",
        )
      ) {
        /* skip modifiers */
      }
      if (s.word("table")) return this.createTable(s);
      if (s.word("type")) return this.createType(s);
      return;
    }
    if (s.word("alter")) {
      if (s.word("table")) this.alterTable(s);
      return;
    }
    if (s.word("comment")) this.commentOn(s);
  }

  finish(tokens: Token[]): SchemaDraft {
    for (const { table, column, text } of this.comments) {
      const target = this.findTable(table);
      if (!target) continue;
      if (!column) target.comment = text;
      else {
        const col = target.columns.find((c) => same(c.name, column));
        if (col) col.comment = text;
      }
    }
    this.draft.dialect = guessDialect(tokens);
    return this.draft;
  }

  // CREATE TABLE [IF NOT EXISTS] name ( items ) [options]
  private createTable(s: Cursor): void {
    const line = s.line();
    if (s.word("if")) s.expectWord("not") && s.expectWord("exists");
    const name = s.name("table name");
    if (!s.peekPunct("(")) {
      this.warnings.push({
        message: `CREATE TABLE "${name}" without columns was ignored`,
        line,
      });
      return;
    }
    const table: DraftTable = { name, columns: [], line };
    for (const item of s.list()) this.tableItem(table, item);
    while (!s.done()) {
      if (s.word("comment")) {
        s.punct("=");
        table.comment = s.string();
      } else s.next();
    }
    this.draft.tables.push(table);
  }

  private tableItem(table: DraftTable, s: Cursor): void {
    if (s.word("constraint")) s.name("constraint name");
    if (s.word("primary")) {
      s.expectWord("key");
      table.primaryKey = s.nameList();
    } else if (s.word("unique")) {
      s.word("key", "index");
      if (!s.peekPunct("(")) s.name("index name");
      this.unique(table, s.nameList(), s.line());
    } else if (s.word("foreign")) {
      s.expectWord("key");
      this.foreignKey(table.name, s.nameList(), s);
    } else if (
      s.peekWord("check", "key", "index", "fulltext", "spatial", "exclude")
    ) {
      /* not part of the model */
    } else {
      table.columns.push(this.column(table.name, s));
    }
  }

  private column(tableName: string, s: Cursor): DraftColumn {
    const column = draftColumn(s.name("column name"));
    column.type = this.columnType(tableName, column.name, s);
    if (/^(small|big)?serial$/i.test(column.type)) column.autoIncrement = true;

    while (!s.done()) {
      const line = s.line();
      if (s.word("not")) {
        s.expectWord("null");
        column.nullable = false;
      } else if (s.word("null")) column.nullable = true;
      else if (s.word("primary")) {
        s.expectWord("key");
        column.primaryKey = true;
        column.nullable = false;
      } else if (s.word("unique")) {
        s.word("key");
        column.unique = true;
      } else if (s.word("default")) {
        column.default = s.textUntil((t) => isConstraintWord(t));
      } else if (s.word("references")) {
        this.reference(tableName, [column.name], s, line);
      } else if (s.word("check")) s.skipGroup();
      else if (s.word("constraint")) s.name("constraint name");
      else if (s.word("auto_increment", "autoincrement"))
        column.autoIncrement = true;
      else if (s.word("identity")) {
        column.autoIncrement = true;
        if (s.peekPunct("(")) s.skipGroup();
      } else if (s.word("generated")) {
        s.word("always");
        if (s.word("by")) s.expectWord("default");
        s.expectWord("as");
        if (s.word("identity")) {
          column.autoIncrement = true;
          if (s.peekPunct("(")) s.skipGroup();
        } else {
          s.skipGroup();
          s.word("stored", "virtual");
        }
      } else if (s.word("comment")) column.comment = s.string();
      else if (s.word("collate")) s.next();
      else if (s.word("on")) {
        s.expectWord("update");
        s.textUntil((t) => isConstraintWord(t));
      } else s.next();
    }
    return column;
  }

  /** The type is everything up to the first constraint word. */
  private columnType(tableName: string, columnName: string, s: Cursor): string {
    const first = s.peek();
    if (
      first?.kind === "word" &&
      /^enum$/i.test(first.value) &&
      s.peekPunct("(", 1)
    ) {
      s.next();
      const values = s.list().map((v) => v.string());
      const name = `${tableName}_${columnName}`;
      this.draft.enums.push({ name, values });
      return name;
    }
    return s
      .textUntil(
        (t, next) =>
          isConstraintWord(t) ||
          (t.kind === "word" &&
            /^character$/i.test(t.value) &&
            next?.kind === "word" &&
            /^set$/i.test(next.value)),
      )
      .replace(/\s+/g, " ")
      .replace(/\s*\(\s*/g, "(")
      .replace(/\s*,\s*/g, ",")
      .replace(/\s*\)/g, ")");
  }

  private unique(table: DraftTable, names: string[], line: number): void {
    if (names.length !== 1) {
      this.warnings.push({
        message: `Unique constraint on several columns in "${table.name}" was ignored`,
        line,
      });
      return;
    }
    const column = table.columns.find((c) => same(c.name, names[0]!));
    if (column) column.unique = true;
  }

  // FOREIGN KEY (cols) REFERENCES t [(cols)] [ON DELETE x] [ON UPDATE y]
  private foreignKey(
    tableName: string,
    columns: string[],
    s: Cursor,
    name?: string,
  ): void {
    const line = s.line();
    s.expectWord("references");
    this.reference(tableName, columns, s, line, name);
  }

  private reference(
    tableName: string,
    columns: string[],
    s: Cursor,
    line: number,
    name?: string,
  ): void {
    const toTable = s.name("referenced table");
    const toColumns = s.peekPunct("(") ? s.nameList() : undefined;
    let onDelete: RefAction | undefined;
    let onUpdate: RefAction | undefined;
    while (s.peekWord("on", "match", "deferrable", "not", "initially")) {
      if (s.word("on")) {
        const event = s.word("delete")
          ? "delete"
          : (s.expectWord("update"), "update");
        const action = this.action(s, line);
        if (event === "delete") onDelete = action;
        else onUpdate = action;
      } else if (s.word("match")) s.next();
      else if (s.word("deferrable")) {
        /* skip */
      } else if (s.word("not")) s.expectWord("deferrable");
      else if (s.word("initially")) s.next();
    }
    this.draft.refs.push({
      fromTable: tableName,
      fromColumns: columns,
      toTable,
      ...(toColumns ? { toColumns } : {}),
      ...(onDelete ? { onDelete } : {}),
      ...(onUpdate ? { onUpdate } : {}),
      ...(name ? { name } : {}),
      kind: "many-to-one",
      line,
    });
  }

  private action(s: Cursor, line: number): RefAction {
    if (s.word("cascade")) return "cascade";
    if (s.word("restrict")) return "restrict";
    if (s.word("no")) {
      s.expectWord("action");
      return "no action";
    }
    if (s.word("set")) {
      if (s.word("null")) return "set null";
      s.expectWord("default");
      this.warnings.push({
        message: "SET DEFAULT is not supported; NO ACTION is used instead",
        line,
      });
      return "no action";
    }
    throw new SqlError(
      "Expected CASCADE, RESTRICT, NO ACTION or SET NULL",
      line,
    );
  }

  // ALTER TABLE [ONLY] [IF EXISTS] name ADD … [, ADD …]
  private alterTable(s: Cursor): void {
    s.word("only");
    if (s.word("if")) s.expectWord("exists");
    const tableName = s.name("table name");
    for (const action of s.restSplitByComma()) {
      if (!action.word("add")) continue;
      const name = action.word("constraint")
        ? action.name("constraint name")
        : undefined;
      if (action.word("foreign")) {
        action.expectWord("key");
        this.foreignKey(tableName, action.nameList(), action, name);
        continue;
      }
      const table = this.findTable(tableName);
      if (!table) {
        this.warnings.push({
          message: `ALTER TABLE on unknown table "${tableName}" was ignored`,
          line: action.line(),
        });
        continue;
      }
      if (action.word("primary")) {
        action.expectWord("key");
        table.primaryKey = action.nameList();
      } else if (action.word("unique")) {
        action.word("key", "index");
        this.unique(table, action.nameList(), action.line());
      } else if (!action.peekWord("check", "index", "key")) {
        action.word("column");
        if (action.word("if"))
          action.expectWord("not") && action.expectWord("exists");
        table.columns.push(this.column(table.name, action));
      }
    }
  }

  // CREATE TYPE name AS ENUM ('a', 'b')
  private createType(s: Cursor): void {
    const name = s.name("type name");
    if (!s.word("as") || !s.word("enum")) return;
    const values = s.list().map((v) => v.string());
    this.draft.enums.push({ name, values });
  }

  // COMMENT ON TABLE t IS '…' | COMMENT ON COLUMN t.c IS '…'
  private commentOn(s: Cursor): void {
    if (!s.word("on")) return;
    if (s.word("table")) {
      const table = s.name("table name");
      s.expectWord("is");
      this.comments.push({ table, text: s.string() });
    } else if (s.word("column")) {
      const parts = s.qualifiedName();
      s.expectWord("is");
      const column = parts.at(-1)!;
      const table = parts.at(-2) ?? "";
      this.comments.push({ table, column, text: s.string() });
    }
  }

  private findTable(name: string): DraftTable | undefined {
    return this.draft.tables.find((t) => same(t.name, name));
  }
}

// --- Cursor over the tokens of one statement --------------------------------

class Cursor {
  private i = 0;

  constructor(
    private readonly tokens: Token[],
    private readonly source: string,
  ) {}

  done(): boolean {
    return this.i >= this.tokens.length;
  }

  peek(offset = 0): Token | undefined {
    return this.tokens[this.i + offset];
  }

  next(): Token | undefined {
    return this.tokens[this.i++];
  }

  line(): number {
    return (this.peek() ?? this.tokens.at(-1))?.line ?? 1;
  }

  /** Consumes the next token if it is one of these words. */
  word(...words: string[]): boolean {
    if (!this.peekWord(...words)) return false;
    this.i++;
    return true;
  }

  peekWord(...words: string[]): boolean {
    const t = this.peek();
    return t?.kind === "word" && words.includes(t.value.toLowerCase());
  }

  expectWord(word: string): true {
    if (!this.word(word)) throw this.error(`Expected ${word.toUpperCase()}`);
    return true;
  }

  peekPunct(value: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t?.kind === "punct" && t.value === value;
  }

  punct(value: string): boolean {
    if (!this.peekPunct(value)) return false;
    this.i++;
    return true;
  }

  string(): string {
    const t = this.next();
    if (t?.kind !== "string") throw this.error("Expected a quoted string", t);
    return t.value;
  }

  /** A possibly qualified name (`schema.table`); returns its last part. */
  name(what: string): string {
    return this.qualifiedName(what).at(-1)!;
  }

  qualifiedName(what = "name"): string[] {
    const parts = [this.simpleName(what)];
    while (this.peekPunct(".")) {
      this.i++;
      parts.push(this.simpleName(what));
    }
    return parts;
  }

  /** `(a, b, c)` as names. */
  nameList(): string[] {
    return this.list().map((item) => item.name("column name"));
  }

  /** The items inside `( … )`, split by commas at the top level. */
  list(): Cursor[] {
    if (!this.punct("(")) throw this.error("Expected (");
    const items: Token[][] = [[]];
    let depth = 0;
    for (;;) {
      const t = this.next();
      if (!t) throw this.missing(")");
      if (t.kind === "punct" && t.value === "(") depth++;
      if (t.kind === "punct" && t.value === ")") {
        if (depth === 0) break;
        depth--;
      }
      if (t.kind === "punct" && t.value === "," && depth === 0) items.push([]);
      else items.at(-1)!.push(t);
    }
    return items
      .filter((item) => item.length)
      .map((item) => new Cursor(item, this.source));
  }

  /** The remaining tokens, split by commas at the top level. */
  restSplitByComma(): Cursor[] {
    const items: Token[][] = [[]];
    let depth = 0;
    while (!this.done()) {
      const t = this.next()!;
      if (t.kind === "punct" && t.value === "(") depth++;
      if (t.kind === "punct" && t.value === ")") depth--;
      if (t.kind === "punct" && t.value === "," && depth === 0) items.push([]);
      else items.at(-1)!.push(t);
    }
    return items
      .filter((item) => item.length)
      .map((item) => new Cursor(item, this.source));
  }

  /** Skips a balanced `( … )`. */
  skipGroup(): void {
    this.list();
  }

  /**
   * The source text from here up to (not including) the first top-level
   * token that matches `stop`.
   */
  textUntil(stop: (token: Token, next: Token | undefined) => boolean): string {
    const first = this.peek();
    let last: Token | undefined;
    let depth = 0;
    while (!this.done()) {
      const t = this.peek()!;
      if (depth === 0 && stop(t, this.peek(1))) break;
      if (t.kind === "punct" && t.value === "(") depth++;
      if (t.kind === "punct" && t.value === ")") depth--;
      last = this.next();
    }
    if (!first || !last) return "";
    return this.source.slice(first.start, last.end).trim();
  }

  private simpleName(what: string): string {
    const t = this.next();
    if (t?.kind === "word" || t?.kind === "quoted") return t.value;
    throw this.error(`Expected ${what}`, t);
  }

  private missing(what: string): SqlError {
    return new SqlError(`Missing ${what}`, this.tokens.at(-1)?.line ?? 1);
  }

  private error(message: string, token = this.peek()): SqlError {
    const at = token ?? this.tokens.at(-1);
    const found = token ? ` but found "${token.value}"` : "";
    return new SqlError(`${message}${found}`, at?.line ?? 1);
  }
}

// --- Helpers --------------------------------------------------------------

function isConstraintWord(token: Token): boolean {
  return (
    token.kind === "word" && CONSTRAINT_WORDS.has(token.value.toLowerCase())
  );
}

/** A best guess of the dialect from words only some databases use. */
function guessDialect(tokens: Token[]): Dialect {
  const words = new Set(
    tokens.filter((t) => t.kind === "word").map((t) => t.value.toLowerCase()),
  );
  if (
    tokens.some((t) => t.backtick) ||
    words.has("auto_increment") ||
    words.has("engine")
  ) {
    return "mysql";
  }
  if (words.has("autoincrement") || words.has("rowid")) return "sqlite";
  if (
    [
      "serial",
      "bigserial",
      "smallserial",
      "timestamptz",
      "jsonb",
      "bytea",
      "uuid",
    ].some((w) => words.has(w)) ||
    tokens.some((t) => t.kind === "punct" && t.value === "::")
  ) {
    return "postgres";
  }
  return "generic";
}

function same(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function count(text: string, ch: string): number {
  return text.split(ch).length - 1;
}
