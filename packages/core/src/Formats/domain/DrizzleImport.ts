import type { RefAction } from "../../Relations";
import {
  DRIZZLE_MODULE,
  fromBuilder,
  fromIdentifier,
  TABLE_FUNCTION,
  type DrizzleDialect,
  type OptionValue,
} from "./DrizzleSyntax";
import {
  draftColumn,
  emptyDraft,
  type DraftColumn,
  type DraftTable,
  type ImportIssue,
  type SchemaDraft,
} from "./SchemaDraft";

/**
 * Reads a Drizzle schema (TypeScript) without running it: tables declared
 * with pgTable, mysqlTable or sqliteTable (also through a namespace import
 * or pgSchema), their columns and modifiers, references(), the
 * primaryKey, foreignKey and unique of the third argument, enums (pgEnum,
 * mysqlEnum, text({ enum })), customType with a fixed SQL type, spreads of
 * objects declared in the same file and `/** … *\/` comments.
 *
 * What only running the code would tell (own functions, imports from
 * other files) is skipped with a warning. relations(), indexes, checks
 * and everything else in the file are ignored.
 */
export function readDrizzle(text: string): {
  draft?: SchemaDraft;
  errors: ImportIssue[];
  warnings: ImportIssue[];
} {
  const lexed = tokenize(text);
  if ("error" in lexed) return { errors: [lexed.error], warnings: [] };
  const parser = new Parser(lexed.tokens);
  parser.program();
  if (parser.errors.length) return { errors: parser.errors, warnings: [] };
  const reader = new DrizzleReader(parser.scope, parser.declarations);
  const draft = reader.read();
  return { draft, errors: [], warnings: reader.warnings };
}

// --- Tokens ---------------------------------------------------------------

type Token = {
  kind: "ident" | "string" | "template" | "number" | "punct";
  /** Strings and templates are already unescaped. */
  value: string;
  line: number;
  /** First token of its line. */
  newline: boolean;
  /** A `/** … *\/` comment right before the token. */
  doc?: string;
  /** A template literal with `${…}` inside. */
  interpolated?: boolean;
};

class DrizzleError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
  }
}

const PUNCTUATION = [
  "...",
  "===",
  "!==",
  "=>",
  "?.",
  "??",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
];

function tokenize(text: string): { tokens: Token[] } | { error: ImportIssue } {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let previousLine = 0;
  let doc: string | undefined;

  const push = (
    kind: Token["kind"],
    value: string,
    startLine: number,
    extra: Partial<Token> = {},
  ) => {
    tokens.push({
      kind,
      value,
      line: startLine,
      newline: startLine > previousLine,
      ...(doc !== undefined ? { doc } : {}),
      ...extra,
    });
    previousLine = line;
    doc = undefined;
  };

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
      const body = text.slice(i + 2, close);
      if (body.startsWith("*") && body !== "*") doc = cleanDoc(body.slice(1));
      line += count(body, "\n");
      i = close + 2;
    } else if (ch === '"' || ch === "'") {
      const read = readString(text, i, ch);
      if (!read) return { error: { message: "Unclosed string", line } };
      i = read.end;
      push("string", read.value, start);
    } else if (ch === "`") {
      const read = readTemplate(text, i);
      if (!read) {
        return { error: { message: "Unclosed template string", line } };
      }
      line += read.newlines;
      i = read.end;
      push(
        "template",
        read.value,
        start,
        read.interpolated ? { interpolated: true } : {},
      );
    } else if (
      /[0-9]/.test(ch) ||
      (ch === "." && /[0-9]/.test(text[i + 1] ?? ""))
    ) {
      const match =
        /^(?:0[xXoObB][0-9a-fA-F_]+|[0-9_]*\.?[0-9_]+(?:[eE][+-]?[0-9]+)?)n?/.exec(
          text.slice(i, i + 64),
        )!;
      i += match[0].length;
      push("number", match[0].replaceAll("_", "").replace(/n$/, ""), start);
    } else if (/[\p{L}_$]/u.test(ch)) {
      const begin = i;
      while (i < text.length && /[\p{L}\p{N}_$]/u.test(text[i]!)) i++;
      push("ident", text.slice(begin, i), start);
    } else {
      const value = PUNCTUATION.find((p) => text.startsWith(p, i)) ?? ch;
      i += value.length;
      push("punct", value, start);
    }
  }
  return { tokens };
}

function readString(
  text: string,
  start: number,
  quote: string,
): { value: string; end: number } | undefined {
  let value = "";
  let i = start + 1;
  while (i < text.length) {
    const c = text[i]!;
    if (c === quote) return { value, end: i + 1 };
    if (c === "\n") return undefined;
    if (c === "\\") {
      const [unescaped, next] = readEscape(text, i);
      value += unescaped;
      i = next;
    } else {
      value += c;
      i++;
    }
  }
  return undefined;
}

function readTemplate(
  text: string,
  start: number,
):
  | { value: string; end: number; interpolated: boolean; newlines: number }
  | undefined {
  let value = "";
  let i = start + 1;
  let interpolated = false;
  let newlines = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === "`") return { value, end: i + 1, interpolated, newlines };
    if (c === "\\") {
      const [unescaped, next] = readEscape(text, i);
      value += unescaped;
      i = next;
    } else if (c === "$" && text[i + 1] === "{") {
      interpolated = true;
      let depth = 1;
      i += 2;
      while (i < text.length && depth > 0) {
        if (text[i] === "{") depth++;
        else if (text[i] === "}") depth--;
        else if (text[i] === "\n") newlines++;
        i++;
      }
      value += "${…}";
    } else {
      if (c === "\n") newlines++;
      value += c;
      i++;
    }
  }
  return undefined;
}

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
  v: "\v",
  "0": "\0",
};

/** The character of `\…` at `i` and the index after it. */
function readEscape(text: string, i: number): [string, number] {
  const next = text[i + 1] ?? "";
  if (next in ESCAPES) return [ESCAPES[next]!, i + 2];
  if (next === "x") {
    return [String.fromCharCode(parseInt(text.slice(i + 2, i + 4), 16)), i + 4];
  }
  if (next === "u") {
    if (text[i + 2] === "{") {
      const close = text.indexOf("}", i + 3);
      return [
        String.fromCodePoint(parseInt(text.slice(i + 3, close), 16)),
        close + 1,
      ];
    }
    return [String.fromCharCode(parseInt(text.slice(i + 2, i + 6), 16)), i + 6];
  }
  if (next === "\r" && text[i + 2] === "\n") return ["", i + 3];
  if (next === "\n") return ["", i + 2];
  return [next, i + 2];
}

/** The text of a doc comment, without the leading `*` of each line. */
function cleanDoc(body: string): string {
  return body
    .split("\n")
    .map((l) => l.replace(/^\s*\*(?: |$)/, "").trimEnd())
    .join("\n")
    .trim()
    .replaceAll("*\\/", "*/");
}

// --- Expressions ----------------------------------------------------------

type Expr =
  | { kind: "ident"; name: string; line: number }
  | { kind: "string"; value: string; line: number }
  | { kind: "number"; text: string; line: number }
  | { kind: "boolean"; value: boolean; line: number }
  | { kind: "null"; line: number }
  | {
      kind: "template";
      value: string;
      interpolated: boolean;
      tag?: Expr;
      line: number;
    }
  | { kind: "member"; object: Expr; property: string; line: number }
  | CallExpr
  | { kind: "array"; items: Expr[]; line: number }
  | ObjectExpr
  | { kind: "arrow"; params: string[]; body: Expr; line: number }
  | { kind: "spread"; arg: Expr; line: number }
  /** Anything this reader does not model, e.g. `a + b`. */
  | { kind: "other"; line: number };

type CallExpr = { kind: "call"; callee: Expr; args: Expr[]; line: number };
type ObjectExpr = { kind: "object"; entries: Entry[]; line: number };

type Entry =
  | { kind: "prop"; key: string; value: Expr; doc?: string; line: number }
  | { kind: "spread"; arg: Expr; line: number };

type PropEntry = Extract<Entry, { kind: "prop" }>;

type Declaration = { name: string; init: Expr; doc?: string; line: number };

/** Words that start a statement when they begin a line. */
const STATEMENT_WORDS = new Set([
  "export",
  "import",
  "const",
  "let",
  "var",
  "function",
  "class",
  "type",
  "interface",
  "enum",
  "declare",
]);

const BINARY = new Set([
  "+",
  "-",
  "*",
  "/",
  "%",
  "<",
  ">",
  "<=",
  ">=",
  "==",
  "!=",
  "===",
  "!==",
  "&&",
  "||",
  "??",
  "?",
  "|",
  "&",
  "^",
]);

const OPENERS = new Set(["(", "[", "{"]);
const CLOSERS = new Set([")", "]", "}"]);

/** Calls whose declaration must parse: they are the schema. */
const SCHEMA_CALLS = new Set([
  ...Object.values(TABLE_FUNCTION),
  "pgEnum",
  "customType",
]);

/** What the file imports and declares, to know what each name is. */
class Scope {
  /** Local name → imported name, for imports from drizzle-orm. */
  readonly aliases = new Map<string, string>();
  readonly otherImports = new Set<string>();
  readonly namespaces = new Set<string>();
  /** pgSchema / mysqlSchema variables → their table function. */
  readonly schemas = new Map<string, string>();
  readonly modules: string[] = [];

  addImport(imported: string, local: string, module: string): void {
    if (isDrizzleModule(module)) {
      this.aliases.set(local, imported);
      this.modules.push(module);
    } else {
      this.otherImports.add(local);
    }
  }

  addNamespace(local: string, module: string): void {
    if (isDrizzleModule(module)) {
      this.namespaces.add(local);
      this.modules.push(module);
    } else {
      this.otherImports.add(local);
    }
  }

  /** The drizzle function a name (`pgTable`, `p.pgTable`, `s.table`) is. */
  callee(first: string, second?: string): string {
    if (second === undefined) return this.aliases.get(first) ?? first;
    if (this.namespaces.has(first)) return second;
    const table = this.schemas.get(first);
    if (table && second === "table") return table;
    if (table && second === "enum") return "pgEnum";
    return "";
  }

  calleeOf(expr: Expr): string {
    if (expr.kind === "ident") return this.callee(expr.name);
    if (expr.kind === "member" && expr.object.kind === "ident") {
      return this.callee(expr.object.name, expr.property);
    }
    return "";
  }

  /** Whether a name is a column builder from drizzle (`integer`, …). */
  isBuilder(name: string): boolean {
    if (this.aliases.has(name)) return true;
    // A snippet without imports from a drizzle core module: trust the names.
    const core = Object.values(DRIZZLE_MODULE);
    return (
      !this.modules.some((m) => core.includes(m)) &&
      !this.otherImports.has(name)
    );
  }
}

function isDrizzleModule(module: string): boolean {
  return module === "drizzle-orm" || module.startsWith("drizzle-orm/");
}

class Parser {
  readonly scope = new Scope();
  readonly declarations: Declaration[] = [];
  readonly errors: ImportIssue[] = [];
  private i = 0;

  constructor(private readonly tokens: Token[]) {}

  program(): void {
    while (!this.done()) {
      const start = this.i;
      try {
        this.statement();
      } catch (error) {
        if (!(error instanceof DrizzleError)) throw error;
        this.errors.push({ message: error.message, line: error.line });
        this.recover(start);
      }
    }
  }

  // --- Statements ---------------------------------------------------------

  private statement(): void {
    const first = this.peek()!;
    if (isIdent(first, "import")) return this.importStatement();
    let doc = first.doc;
    if (isIdent(first, "export")) {
      this.i++;
      doc ??= this.peek()?.doc;
      if (!isIdent(this.peek(), "const", "let", "var")) {
        return this.skipStatement();
      }
    }
    if (isIdent(this.peek(), "const", "let", "var")) {
      return this.declaration(doc);
    }
    if (isPunct(this.peek(), ";")) {
      this.i++;
      return;
    }
    this.skipStatement();
  }

  // import { a, b as c } from "x" | import * as ns from "x" | import "x"
  private importStatement(): void {
    const start = this.next()!;
    const named: [string, string][] = [];
    let namespace: string | undefined;
    while (!this.done() && this.peek()!.kind !== "string") {
      const t = this.next()!;
      if (isPunct(t, "{")) {
        while (!this.done() && !isPunct(this.peek(), "}")) {
          let imported = this.next()!;
          if (isIdent(imported, "type") && this.peek()?.kind === "ident") {
            imported = this.next()!;
          }
          let local = imported.value;
          if (isIdent(this.peek(), "as")) {
            this.i++;
            local = this.next()?.value ?? local;
          }
          named.push([imported.value, local]);
          this.punct(",");
        }
        this.punct("}");
      } else if (isPunct(t, "*")) {
        if (isIdent(this.peek(), "as")) this.i++;
        namespace = this.next()?.value;
      }
    }
    const module = this.next();
    if (module?.kind !== "string") {
      throw new DrizzleError("Expected the module of the import", start.line);
    }
    for (const [imported, local] of named) {
      this.scope.addImport(imported, local, module.value);
    }
    if (namespace) this.scope.addNamespace(namespace, module.value);
    this.punct(";");
  }

  // const name [: type] = expression
  private declaration(doc: string | undefined): void {
    const keyword = this.next()!;
    const name = this.peek();
    if (name?.kind !== "ident") return this.skipStatement();
    this.i++;
    if (this.punct(":")) this.skipType();
    if (!this.punct("=")) return this.skipStatement();

    const kind = this.initializerKind();
    if (kind === "skip") return this.skipStatement();
    const start = this.i;
    let init: Expr;
    if (kind === "strict") {
      init = this.expression();
    } else {
      try {
        init = this.expression();
      } catch (error) {
        if (!(error instanceof DrizzleError)) throw error;
        this.i = start;
        return this.skipStatement();
      }
    }
    this.declarations.push({
      name: name.value,
      init,
      line: keyword.line,
      ...(doc ? { doc } : {}),
    });
    if (init.kind === "call") {
      const fn = this.scope.calleeOf(init.callee);
      if (fn === "pgSchema") this.scope.schemas.set(name.value, "pgTable");
      if (fn === "mysqlSchema")
        this.scope.schemas.set(name.value, "mysqlTable");
    }
    if (this.punct(";")) return;
    const next = this.peek();
    if (next && !next.newline) this.skipStatement();
  }

  /**
   * Tables, enums and custom types must parse (a mistake there is an
   * error); literals and schemas are read if possible; anything else is
   * skipped without looking.
   */
  private initializerKind(): "strict" | "loose" | "skip" {
    const t = this.peek();
    if (isPunct(t, "[") || isPunct(t, "{")) return "loose";
    if (t?.kind !== "ident") return "skip";
    let second: string | undefined;
    let after = this.peek(1);
    if (isPunct(after, ".") && this.peek(2)?.kind === "ident") {
      second = this.peek(2)!.value;
      after = this.peek(3);
    }
    if (!isPunct(after, "(") && !isPunct(after, "<")) return "skip";
    const fn = this.scope.callee(t.value, second);
    if (SCHEMA_CALLS.has(fn)) return "strict";
    return fn === "pgSchema" || fn === "mysqlSchema" ? "loose" : "skip";
  }

  /** Skips to the end of a statement we do not read. */
  private skipStatement(): void {
    const first = this.i;
    let depth = 0;
    while (!this.done()) {
      const t = this.peek()!;
      if (this.i > first && depth === 0 && startsStatement(t)) return;
      this.i++;
      if (t.kind !== "punct") continue;
      if (OPENERS.has(t.value)) depth++;
      else if (CLOSERS.has(t.value) && --depth < 0) return;
      else if (t.value === ";" && depth === 0) return;
    }
  }

  /** After an error, continues at the next statement. */
  private recover(start: number): void {
    let j = Math.max(this.i, start + 1);
    while (j < this.tokens.length && !startsStatement(this.tokens[j]!)) j++;
    this.i = j;
  }

  // --- Expressions --------------------------------------------------------

  private expression(): Expr {
    const expr = this.unary();
    while (isIdent(this.peek(), "as", "satisfies") && !this.peek()!.newline) {
      this.i++;
      this.skipType();
    }
    const t = this.peek();
    if (t?.kind === "punct" && BINARY.has(t.value)) {
      this.skipExpression();
      return { kind: "other", line: expr.line };
    }
    return expr;
  }

  private unary(): Expr {
    const t = this.peek();
    if (!t) throw this.error("Unexpected end of the file");
    if (
      (isPunct(t, "-") || isPunct(t, "+")) &&
      this.peek(1)?.kind === "number"
    ) {
      this.i += 2;
      const sign = t.value === "-" ? "-" : "";
      return {
        kind: "number",
        text: sign + this.tokens[this.i - 1]!.value,
        line: t.line,
      };
    }
    if (
      isPunct(t, "!", "-", "+") ||
      isIdent(t, "typeof", "void", "await", "new")
    ) {
      this.i++;
      this.unary();
      return { kind: "other", line: t.line };
    }
    return this.postfix(this.primary());
  }

  private primary(): Expr {
    const t = this.peek()!;
    const line = t.line;
    switch (t.kind) {
      case "string":
        this.i++;
        return { kind: "string", value: t.value, line };
      case "number":
        this.i++;
        return { kind: "number", text: t.value, line };
      case "template":
        this.i++;
        return {
          kind: "template",
          value: t.value,
          interpolated: Boolean(t.interpolated),
          line,
        };
      case "ident":
        this.i++;
        if (t.value === "true" || t.value === "false") {
          return { kind: "boolean", value: t.value === "true", line };
        }
        if (t.value === "null" || t.value === "undefined") {
          return { kind: "null", line };
        }
        if (t.value === "function") return this.skipFunction(line);
        if (this.punct("=>")) return this.arrowBody([t.value], line);
        return { kind: "ident", name: t.value, line };
      case "punct":
        if (t.value === "(") return this.parenthesesOrArrow();
        if (t.value === "[") return this.array();
        if (t.value === "{") return this.object();
    }
    throw new DrizzleError(`Unexpected "${t.value}"`, t.line);
  }

  private postfix(start: Expr): Expr {
    let expr = start;
    for (;;) {
      const t = this.peek();
      if (!t) return expr;
      if (isPunct(t, ".", "?.")) {
        const name = this.peek(1);
        if (isPunct(t, "?.") && isPunct(name, "(")) {
          this.i++;
          continue;
        }
        if (name?.kind !== "ident")
          throw this.error("Expected a name after .", name);
        this.i += 2;
        expr = {
          kind: "member",
          object: expr,
          property: name.value,
          line: name.line,
        };
      } else if (isPunct(t, "(")) {
        this.i++;
        expr = {
          kind: "call",
          callee: expr,
          args: this.items(")"),
          line: t.line,
        };
      } else if (isPunct(t, "<") && this.typeArguments()) {
        continue;
      } else if (t.kind === "template") {
        this.i++;
        expr = {
          kind: "template",
          value: t.value,
          interpolated: Boolean(t.interpolated),
          tag: expr,
          line: t.line,
        };
      } else if (isPunct(t, "!")) {
        this.i++; // non-null assertion
      } else if (isPunct(t, "[") && !t.newline) {
        this.i++;
        const key = this.expression();
        this.expectPunct("]");
        expr =
          key.kind === "string"
            ? {
                kind: "member",
                object: expr,
                property: key.value,
                line: t.line,
              }
            : { kind: "other", line: t.line };
      } else {
        return expr;
      }
    }
  }

  // ( … ) => body | ( expression )
  private parenthesesOrArrow(): Expr {
    const open = this.peek()!;
    const close = this.matching(this.i);
    const after = this.tokens[close + 1];
    if (isPunct(after, "=>") || isPunct(after, ":")) {
      const params = this.params(this.i + 1, close);
      this.i = close + 1;
      if (this.punct(":")) this.skipType();
      this.expectPunct("=>");
      return this.arrowBody(params, open.line);
    }
    this.i++;
    const inner = this.expression();
    this.expectPunct(")");
    return inner;
  }

  private arrowBody(params: string[], line: number): Expr {
    const body = isPunct(this.peek(), "{")
      ? this.blockReturn()
      : this.expression();
    return { kind: "arrow", params, body, line };
  }

  /** The expression a block `{ … return x; }` returns. */
  private blockReturn(): Expr {
    const open = this.i;
    const close = this.matching(open);
    let result: Expr = { kind: "other", line: this.tokens[open]!.line };
    let depth = 0;
    for (let j = open; j < close; j++) {
      const t = this.tokens[j]!;
      if (t.kind === "punct" && OPENERS.has(t.value)) depth++;
      else if (t.kind === "punct" && CLOSERS.has(t.value)) depth--;
      else if (depth === 1 && isIdent(t, "return")) {
        this.i = j + 1;
        result = this.expression();
        break;
      }
    }
    this.i = close + 1;
    return result;
  }

  private array(): Expr {
    const line = this.next()!.line;
    return { kind: "array", items: this.items("]"), line };
  }

  /** Comma-separated items up to `close` (spreads allowed). */
  private items(close: string): Expr[] {
    const items: Expr[] = [];
    while (!isPunct(this.peek(), close)) {
      if (this.done()) throw this.error(`Missing ${close}`);
      const t = this.peek()!;
      if (this.punct("...")) {
        items.push({ kind: "spread", arg: this.expression(), line: t.line });
      } else if (!isPunct(t, ",")) {
        items.push(this.expression());
      }
      if (!this.punct(",")) break;
    }
    this.expectPunct(close);
    return items;
  }

  private object(): ObjectExpr {
    const line = this.next()!.line;
    const entries: Entry[] = [];
    while (!isPunct(this.peek(), "}")) {
      if (this.done()) throw this.error("Missing }");
      const t = this.peek()!;
      if (this.punct("...")) {
        entries.push({ kind: "spread", arg: this.expression(), line: t.line });
      } else {
        const keyToken = this.next()!;
        let key: string | undefined;
        if (keyToken.kind === "punct" && keyToken.value === "[") {
          this.i = this.matching(this.i - 1) + 1; // computed key: skipped
        } else if (keyToken.kind === "punct") {
          throw new DrizzleError(
            `Unexpected "${keyToken.value}"`,
            keyToken.line,
          );
        } else {
          key = keyToken.value;
        }
        let value: Expr;
        if (this.punct(":")) {
          value = this.expression();
        } else if (isPunct(this.peek(), "(")) {
          // method: name(params) { … }
          const close = this.matching(this.i);
          const params = this.params(this.i + 1, close);
          this.i = close + 1;
          if (this.punct(":")) this.skipType();
          if (!isPunct(this.peek(), "{")) throw this.error("Expected {");
          value = {
            kind: "arrow",
            params,
            body: this.blockReturn(),
            line: keyToken.line,
          };
        } else {
          value = { kind: "ident", name: key ?? "", line: keyToken.line };
        }
        if (key !== undefined) {
          entries.push({
            kind: "prop",
            key,
            value,
            line: keyToken.line,
            ...(keyToken.doc ? { doc: keyToken.doc } : {}),
          });
        }
      }
      if (!this.punct(",")) break;
    }
    this.expectPunct("}");
    return { kind: "object", entries, line };
  }

  /** The names of the parameters between `from` and `to`. */
  private params(from: number, to: number): string[] {
    const params: string[] = [];
    let depth = 0;
    let expecting = true;
    for (let j = from; j < to; j++) {
      const t = this.tokens[j]!;
      if (depth === 0 && expecting && t.kind === "ident") params.push(t.value);
      if (depth === 0 && expecting && (isPunct(t, "{") || isPunct(t, "["))) {
        params.push("");
      }
      if (t.kind === "punct" && OPENERS.has(t.value)) depth++;
      if (t.kind === "punct" && CLOSERS.has(t.value)) depth--;
      expecting = depth === 0 && (isPunct(t, ",") || isPunct(t, "..."));
    }
    return params;
  }

  private skipFunction(line: number): Expr {
    if (this.peek()?.kind === "ident") this.i++;
    if (isPunct(this.peek(), "(")) this.i = this.matching(this.i) + 1;
    if (this.punct(":")) this.skipType();
    if (isPunct(this.peek(), "{")) this.i = this.matching(this.i) + 1;
    return { kind: "other", line };
  }

  /** Skips `<…>` when a call follows (`customType<…>(…)`). */
  private typeArguments(): boolean {
    let depth = 0;
    for (let j = this.i; j < this.tokens.length; j++) {
      const t = this.tokens[j]!;
      if (t.kind !== "punct") continue;
      if (t.value === "<" || OPENERS.has(t.value)) depth++;
      else if (t.value === ">" || CLOSERS.has(t.value)) {
        if (--depth > 0) continue;
        if (t.value === ">" && isPunct(this.tokens[j + 1], "(")) {
          this.i = j + 1;
          return true;
        }
        return false;
      } else if (t.value === ";") return false;
    }
    return false;
  }

  /** Skips a type annotation (`: Foo<Bar>`, `as const`…). */
  private skipType(): void {
    const first = this.i;
    let depth = 0;
    let expecting = true;
    while (!this.done()) {
      const t = this.peek()!;
      if (depth === 0) {
        if (isPunct(t, ",", ")", "]", "}", ";", "=", "=>")) return;
        if (this.i > first && startsStatement(t)) return;
        if (!expecting && (isPunct(t, "{") || t.kind === "ident")) return;
      }
      this.i++;
      if (t.kind === "punct" && (OPENERS.has(t.value) || t.value === "<")) {
        depth++;
        expecting = true;
      } else if (
        t.kind === "punct" &&
        (CLOSERS.has(t.value) || t.value === ">")
      ) {
        depth--;
        expecting = false;
      } else {
        expecting = t.kind === "punct";
      }
    }
  }

  /** Skips the rest of an expression we do not model. */
  private skipExpression(): void {
    let depth = 0;
    while (!this.done()) {
      const t = this.peek()!;
      if (depth === 0) {
        if (isPunct(t, ",", ")", "]", "}", ";")) return;
        if (startsStatement(t)) return;
      }
      this.i++;
      if (t.kind === "punct" && OPENERS.has(t.value)) depth++;
      if (t.kind === "punct" && CLOSERS.has(t.value)) depth--;
    }
  }

  // --- Helpers ------------------------------------------------------------

  /** Index of the bracket that closes the one at `open`. */
  private matching(open: number): number {
    let depth = 0;
    for (let j = open; j < this.tokens.length; j++) {
      const t = this.tokens[j]!;
      if (t.kind !== "punct") continue;
      if (OPENERS.has(t.value)) depth++;
      else if (CLOSERS.has(t.value) && --depth === 0) return j;
    }
    const closer = { "(": ")", "[": "]", "{": "}" }[this.tokens[open]!.value];
    throw new DrizzleError(`Missing ${closer}`, this.tokens.at(-1)!.line);
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

  private punct(value: string): boolean {
    if (!isPunct(this.peek(), value)) return false;
    this.i++;
    return true;
  }

  private expectPunct(value: string): void {
    if (!this.punct(value)) throw this.error(`Expected ${value}`);
  }

  private error(message: string, token = this.peek()): DrizzleError {
    const found = token ? ` but found "${token.value}"` : "";
    return new DrizzleError(
      `${message}${found}`,
      token?.line ?? this.tokens.at(-1)?.line ?? 1,
    );
  }
}

function isPunct(token: Token | undefined, ...values: string[]): boolean {
  return token?.kind === "punct" && values.includes(token.value);
}

function isIdent(token: Token | undefined, ...values: string[]): boolean {
  return token?.kind === "ident" && values.includes(token.value);
}

function startsStatement(token: Token): boolean {
  return (
    token.newline && token.kind === "ident" && STATEMENT_WORDS.has(token.value)
  );
}

// --- From declarations to a draft -----------------------------------------

type Modifier = { name: string; args: Expr[]; line: number };

type TableInfo = { table: DraftTable; keys: Map<string, DraftColumn> };

type PendingRef = {
  from: TableInfo;
  fromColumns: DraftColumn[];
  /** Variable of the referenced table. */
  toVar: string;
  toKeys: string[];
  name?: string;
  onDelete?: RefAction;
  onUpdate?: RefAction;
  line: number;
};

type Builder =
  | { kind: "builder"; name: string }
  | { kind: "enum"; name: string }
  | { kind: "custom"; type: string };

class DrizzleReader {
  readonly warnings: ImportIssue[] = [];
  private readonly draft = emptyDraft();
  private dialect: DrizzleDialect = "postgres";

  private readonly enums = new Map<string, string>();
  private readonly lists = new Map<
    string,
    { values: string[]; doc?: string }
  >();
  private readonly listEnums = new Map<string, string>();
  private readonly customTypes = new Map<string, string>();
  private readonly objects = new Map<string, ObjectExpr>();
  private readonly tables = new Map<string, TableInfo>();
  private readonly pending: PendingRef[] = [];

  constructor(
    private readonly scope: Scope,
    private readonly declarations: Declaration[],
  ) {}

  read(): SchemaDraft {
    this.dialect = this.detectDialect();
    // Enums, custom types and shared objects first, so tables can use them
    // wherever they are declared.
    for (const decl of this.declarations) {
      const { init } = decl;
      if (init.kind === "array") {
        const values = stringList(init);
        if (values) {
          this.lists.set(decl.name, {
            values,
            ...(decl.doc ? { doc: decl.doc } : {}),
          });
        }
      } else if (init.kind === "object") {
        this.objects.set(decl.name, init);
      } else {
        const base = chainOf(init)?.base;
        const fn = base ? this.scope.calleeOf(base.callee) : "";
        if (fn === "pgEnum") this.pgEnum(decl, base!);
        if (fn === "customType") this.customType(decl, base!);
      }
    }
    for (const decl of this.declarations) {
      const base = chainOf(decl.init)?.base;
      if (!base) continue;
      const fn = this.scope.calleeOf(base.callee);
      if (Object.values(TABLE_FUNCTION).includes(fn)) this.table(decl, base);
    }
    this.resolveRefs();
    this.draft.dialect = this.dialect;
    return this.draft;
  }

  private detectDialect(): DrizzleDialect {
    const dialects = Object.keys(DRIZZLE_MODULE) as DrizzleDialect[];
    for (const module of this.scope.modules) {
      const found = dialects.find((d) => DRIZZLE_MODULE[d] === module);
      if (found) return found;
    }
    for (const decl of this.declarations) {
      const base = chainOf(decl.init)?.base;
      const fn = base ? this.scope.calleeOf(base.callee) : "";
      const found = dialects.find((d) => TABLE_FUNCTION[d] === fn);
      if (found) return found;
    }
    return "postgres";
  }

  // pgEnum("name", ["a", "b"])
  private pgEnum(decl: Declaration, call: CallExpr): void {
    const name = literalString(call.args[0]) ?? fromIdentifier(decl.name);
    const values = this.valuesOf(call.args[1]);
    if (!values) {
      this.warn(
        `Enum "${name}" was skipped: its values are not a list of strings`,
        decl.line,
      );
      return;
    }
    this.draft.enums.push({
      name,
      values,
      ...(decl.doc ? { note: decl.doc } : {}),
    });
    this.enums.set(decl.name, name);
  }

  // customType<…>({ dataType: () => "geometry" })
  private customType(decl: Declaration, call: CallExpr): void {
    const dataType = objectProp(call.args[0], "dataType");
    const type =
      dataType?.kind === "arrow" ? literalString(dataType.body) : undefined;
    if (type === undefined) {
      this.warn(
        `Custom type "${decl.name}" is read as text: its SQL type is not a fixed string`,
        decl.line,
      );
    }
    this.customTypes.set(decl.name, type ?? "text");
  }

  // pgTable("name", { columns }, (t) => [constraints])
  private table(decl: Declaration, call: CallExpr): void {
    const [nameArg, columnsArg, extraArg] = call.args;
    let name = literalString(nameArg);
    if (name === undefined) {
      this.warn(
        `The name of table "${decl.name}" is not a string; the variable name was used`,
        decl.line,
      );
      name = decl.name;
    }
    const table: DraftTable = {
      name,
      columns: [],
      line: decl.line,
      ...(decl.doc ? { comment: decl.doc } : {}),
    };
    const info: TableInfo = { table, keys: new Map() };

    // Columns as an object, or as a callback: (t) => ({ id: t.integer() }).
    let columns = columnsArg;
    let builders: string | undefined;
    if (columns?.kind === "arrow") {
      builders = columns.params[0];
      columns = columns.body;
    }
    if (columns?.kind === "ident") columns = this.objects.get(columns.name);
    if (columns?.kind !== "object") {
      this.warn(
        `Table "${name}" was skipped: its columns can't be read`,
        decl.line,
      );
      return;
    }
    for (const entry of this.entries(columns, name, new Set())) {
      this.column(info, entry, builders);
    }
    this.tables.set(decl.name, info);
    this.draft.tables.push(table);
    if (extraArg) this.constraints(info, decl.name, extraArg);
  }

  /** The props of an object, with spreads of local objects expanded. */
  private entries(
    object: ObjectExpr,
    table: string,
    seen: Set<string>,
  ): PropEntry[] {
    const result: PropEntry[] = [];
    for (const entry of object.entries) {
      if (entry.kind === "prop") {
        result.push(entry);
        continue;
      }
      const name = entry.arg.kind === "ident" ? entry.arg.name : undefined;
      const target = name ? this.objects.get(name) : undefined;
      if (name && target && !seen.has(name)) {
        result.push(...this.entries(target, table, new Set([...seen, name])));
      } else {
        this.warn(
          `Columns spread into "${table}" can't be read without running the code; they were skipped`,
          entry.line,
        );
      }
    }
    return result;
  }

  private column(info: TableInfo, entry: PropEntry, builders?: string): void {
    const tableName = info.table.name;
    const chain = chainOf(entry.value);
    const builder = chain && this.builderOf(chain.base.callee, builders);
    if (!chain || !builder) {
      this.warn(
        `Column "${entry.key}" in "${tableName}" was skipped: it can't be read without running the code`,
        entry.line,
      );
      return;
    }

    let args = chain.base.args;
    const explicitName = literalString(args[0]);
    if (explicitName !== undefined) args = args.slice(1);
    const column = draftColumn(explicitName ?? entry.key);
    const options = args[0]?.kind === "object" ? args[0] : undefined;
    const builderName = builder.kind === "builder" ? builder.name : "";

    if (builder.kind === "enum") column.type = builder.name;
    else if (builder.kind === "custom") column.type = builder.type;
    else if (builderName === "mysqlEnum") {
      column.type = this.inlineEnum(
        args[0],
        tableName,
        column.name,
        entry.line,
      );
    } else if (objectProp(options, "enum")) {
      column.type = this.inlineEnum(
        objectProp(options, "enum"),
        tableName,
        column.name,
        entry.line,
      );
    } else {
      column.type =
        fromBuilder(builderName, literalOptions(options), this.dialect) ??
        builderName;
    }
    if (/^(small|big)?serial$/.test(builderName)) column.autoIncrement = true;
    if (entry.doc) column.comment = entry.doc;

    const numeric = builderName === "numeric" || builderName === "decimal";
    for (const modifier of chain.modifiers) {
      this.modifier(info, column, modifier, numeric);
    }
    info.keys.set(entry.key, column);
    info.table.columns.push(column);
  }

  private modifier(
    info: TableInfo,
    column: DraftColumn,
    { name, args, line }: Modifier,
    numeric: boolean,
  ): void {
    switch (name) {
      case "primaryKey":
        column.primaryKey = true;
        column.nullable = false;
        if (objectProp(args[0], "autoIncrement")?.kind === "boolean") {
          column.autoIncrement = true;
        }
        break;
      case "notNull":
        column.nullable = false;
        break;
      case "unique":
        column.unique = true;
        break;
      case "default": {
        const value = this.defaultText(args[0], numeric);
        if (value === undefined) {
          this.warn(
            `The default of "${column.name}" in "${info.table.name}" can't be read; it was skipped`,
            line,
          );
        } else column.default = value;
        break;
      }
      case "defaultNow":
        column.default =
          this.dialect === "sqlite" ? "CURRENT_TIMESTAMP" : "now()";
        break;
      case "defaultRandom":
        column.default = "gen_random_uuid()";
        break;
      case "generatedAlwaysAsIdentity":
      case "generatedByDefaultAsIdentity":
      case "autoincrement":
        column.autoIncrement = true;
        break;
      case "array":
        column.type += "[]";
        break;
      case "references": {
        const body = args[0]?.kind === "arrow" ? args[0].body : undefined;
        if (body?.kind !== "member" || body.object.kind !== "ident") {
          this.warn(
            `The reference of "${column.name}" in "${info.table.name}" can't be read; it was skipped`,
            line,
          );
          break;
        }
        this.pending.push({
          from: info,
          fromColumns: [column],
          toVar: body.object.name,
          toKeys: [body.property],
          ...this.actions(
            literalString(objectProp(args[1], "onDelete")),
            literalString(objectProp(args[1], "onUpdate")),
            line,
          ),
          line,
        });
        break;
      }
    }
  }

  /** The third argument: primaryKey, foreignKey and unique. */
  private constraints(info: TableInfo, varName: string, extra: Expr): void {
    if (extra.kind !== "arrow") return;
    const param = extra.params[0] ?? "";
    const items =
      extra.body.kind === "array"
        ? extra.body.items
        : extra.body.kind === "object"
          ? extra.body.entries.flatMap((e) =>
              e.kind === "prop" ? [e.value] : [],
            )
          : [];
    for (const item of items) {
      const chain = chainOf(item);
      if (!chain) continue;
      const { base, modifiers } = chain;
      const config = base.args[0];
      switch (this.scope.calleeOf(base.callee)) {
        case "primaryKey": {
          const refs =
            config?.kind === "object"
              ? arrayItems(objectProp(config, "columns"))
              : base.args; // older API: primaryKey(t.a, t.b)
          const columns = this.ownColumns(info, param, refs, item.line);
          if (columns) info.table.primaryKey = columns.map((c) => c.name);
          break;
        }
        case "foreignKey": {
          const from = this.ownColumns(
            info,
            param,
            arrayItems(objectProp(config, "columns")),
            item.line,
          );
          const foreign = arrayItems(objectProp(config, "foreignColumns")).map(
            (e) =>
              e.kind === "member" && e.object.kind === "ident"
                ? { table: e.object.name, key: e.property }
                : undefined,
          );
          const target = foreign[0]?.table;
          if (!from || !target || foreign.some((f) => f?.table !== target)) {
            this.warn(
              `A foreign key of "${info.table.name}" can't be read; it was skipped`,
              item.line,
            );
            break;
          }
          const action = (n: string) =>
            literalString(modifiers.find((m) => m.name === n)?.args[0]);
          const name = literalString(objectProp(config, "name"));
          this.pending.push({
            from: info,
            fromColumns: from,
            toVar: target === param ? varName : target,
            toKeys: foreign.map((f) => f!.key),
            ...(name ? { name } : {}),
            ...this.actions(action("onDelete"), action("onUpdate"), item.line),
            line: item.line,
          });
          break;
        }
        case "unique":
        case "uniqueIndex": {
          const on = modifiers.find((m) => m.name === "on");
          const columns =
            on && this.ownColumns(info, param, on.args, item.line);
          if (!columns) break;
          if (columns.length === 1) columns[0]!.unique = true;
          else {
            this.warn(
              `Unique constraint on several columns in "${info.table.name}" was ignored`,
              item.line,
            );
          }
          break;
        }
      }
    }
  }

  /** `t.a, t.b` → the columns of the table. */
  private ownColumns(
    info: TableInfo,
    param: string,
    refs: Expr[],
    line: number,
  ): DraftColumn[] | undefined {
    const columns: DraftColumn[] = [];
    for (const ref of refs) {
      const column =
        ref.kind === "member" &&
        ref.object.kind === "ident" &&
        ref.object.name === param
          ? info.keys.get(ref.property)
          : undefined;
      if (!column) {
        this.warn(`A column of "${info.table.name}" was not found`, line);
        return undefined;
      }
      columns.push(column);
    }
    return columns.length ? columns : undefined;
  }

  private resolveRefs(): void {
    for (const ref of this.pending) {
      const fromName = ref.from.table.name;
      const target = this.tables.get(ref.toVar);
      if (!target) {
        this.warn(
          `Relation from "${fromName}" skipped: "${ref.toVar}" is not a table of this file`,
          ref.line,
        );
        continue;
      }
      const toColumns = ref.toKeys.map((k) => target.keys.get(k));
      if (toColumns.some((c) => !c)) {
        this.warn(
          `Relation from "${fromName}" to "${target.table.name}" skipped: a column does not exist`,
          ref.line,
        );
        continue;
      }
      this.draft.refs.push({
        fromTable: fromName,
        fromColumns: ref.fromColumns.map((c) => c.name),
        toTable: target.table.name,
        toColumns: toColumns.map((c) => c!.name),
        ...(ref.name ? { name: ref.name } : {}),
        ...(ref.onDelete ? { onDelete: ref.onDelete } : {}),
        ...(ref.onUpdate ? { onUpdate: ref.onUpdate } : {}),
        kind: "many-to-one",
        line: ref.line,
      });
    }
  }

  // --- Helpers ------------------------------------------------------------

  /** What a column's base call is: a builder, an enum or a custom type. */
  private builderOf(callee: Expr, builders?: string): Builder | undefined {
    if (callee.kind === "ident") {
      const enumName = this.enums.get(callee.name);
      if (enumName) return { kind: "enum", name: enumName };
      const custom = this.customTypes.get(callee.name);
      if (custom) return { kind: "custom", type: custom };
      if (this.scope.isBuilder(callee.name)) {
        return { kind: "builder", name: this.scope.callee(callee.name) };
      }
      return undefined;
    }
    if (callee.kind === "member" && callee.object.kind === "ident") {
      const owner = callee.object.name;
      if (owner === builders || this.scope.namespaces.has(owner)) {
        return { kind: "builder", name: callee.property };
      }
    }
    return undefined;
  }

  /** Values of a mysqlEnum or `{ enum }`: a list here or a list variable. */
  private inlineEnum(
    expr: Expr | undefined,
    table: string,
    column: string,
    line: number,
  ): string {
    if (expr?.kind === "ident") {
      const list = this.lists.get(expr.name);
      if (list) {
        let name = this.listEnums.get(expr.name);
        if (!name) {
          name = fromIdentifier(expr.name);
          this.listEnums.set(expr.name, name);
          this.draft.enums.push({
            name,
            values: list.values,
            ...(list.doc ? { note: list.doc } : {}),
          });
        }
        return name;
      }
    }
    const values = expr ? stringList(expr) : undefined;
    if (values) {
      const name = `${table}_${column}`;
      this.draft.enums.push({ name, values });
      return name;
    }
    this.warn(
      `The values of "${column}" in "${table}" are not a list of strings; text was used`,
      line,
    );
    return "text";
  }

  private valuesOf(expr: Expr | undefined): string[] | undefined {
    if (expr?.kind === "ident") return this.lists.get(expr.name)?.values;
    return expr ? stringList(expr) : undefined;
  }

  /** A Drizzle default as SQL: `"draft"` → `'draft'`, sql`now()` → `now()`. */
  private defaultText(
    expr: Expr | undefined,
    numeric: boolean,
  ): string | undefined {
    switch (expr?.kind) {
      case "number":
        return expr.text;
      case "boolean":
        return String(expr.value);
      case "null":
        return "null";
      case "string":
        return numeric && /^-?\d+(\.\d+)?$/.test(expr.value)
          ? expr.value
          : sqlString(expr.value);
      case "template":
        if (expr.interpolated) return undefined;
        if (!expr.tag) return sqlString(expr.value);
        return this.scope.calleeOf(expr.tag) === "sql"
          ? expr.value.trim()
          : undefined;
    }
    return undefined;
  }

  private actions(
    onDelete: string | undefined,
    onUpdate: string | undefined,
    line: number,
  ): { onDelete?: RefAction; onUpdate?: RefAction } {
    const del =
      onDelete !== undefined ? this.action(onDelete, line) : undefined;
    const upd =
      onUpdate !== undefined ? this.action(onUpdate, line) : undefined;
    return {
      ...(del ? { onDelete: del } : {}),
      ...(upd ? { onUpdate: upd } : {}),
    };
  }

  private action(value: string, line: number): RefAction | undefined {
    const action = value.toLowerCase();
    if (
      action === "cascade" ||
      action === "restrict" ||
      action === "no action" ||
      action === "set null"
    ) {
      return action;
    }
    if (action === "set default") {
      this.warn(
        "SET DEFAULT is not supported; NO ACTION is used instead",
        line,
      );
      return "no action";
    }
    this.warn(`Unknown action "${value}" was ignored`, line);
    return undefined;
  }

  private warn(message: string, line: number): void {
    this.warnings.push({ message, line });
  }
}

/** `a().b().c()` → base `a()` and modifiers `b`, `c`. */
function chainOf(
  expr: Expr,
): { base: CallExpr; modifiers: Modifier[] } | undefined {
  const modifiers: Modifier[] = [];
  let e = expr;
  while (
    e.kind === "call" &&
    e.callee.kind === "member" &&
    e.callee.object.kind === "call"
  ) {
    modifiers.unshift({ name: e.callee.property, args: e.args, line: e.line });
    e = e.callee.object;
  }
  return e.kind === "call" ? { base: e, modifiers } : undefined;
}

function literalString(expr: Expr | undefined): string | undefined {
  if (expr?.kind === "string") return expr.value;
  if (expr?.kind === "template" && !expr.interpolated && !expr.tag) {
    return expr.value;
  }
  return undefined;
}

function stringList(expr: Expr): string[] | undefined {
  if (expr.kind !== "array") return undefined;
  const values = expr.items.map(literalString);
  return values.every((v) => v !== undefined)
    ? (values as string[])
    : undefined;
}

function objectProp(expr: Expr | undefined, key: string): Expr | undefined {
  if (expr?.kind !== "object") return undefined;
  let value: Expr | undefined;
  for (const entry of expr.entries) {
    if (entry.kind === "prop" && entry.key === key) value = entry.value;
  }
  return value;
}

function arrayItems(expr: Expr | undefined): Expr[] {
  return expr?.kind === "array" ? expr.items : [];
}

function literalOptions(
  expr: ObjectExpr | undefined,
): Record<string, OptionValue> {
  const options: Record<string, OptionValue> = {};
  for (const entry of expr?.entries ?? []) {
    if (entry.kind !== "prop") continue;
    const v = entry.value;
    if (v.kind === "string") options[entry.key] = v.value;
    else if (v.kind === "boolean") options[entry.key] = v.value;
    else if (v.kind === "number") options[entry.key] = Number(v.text);
  }
  return options;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function count(text: string, ch: string): number {
  return text.split(ch).length - 1;
}
