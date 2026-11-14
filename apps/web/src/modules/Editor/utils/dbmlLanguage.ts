import { StreamLanguage, StringStream } from "@codemirror/language";

/** The kind of block the tokenizer is inside. */
type Block = "table" | "enum" | "group" | "project" | "other";

type State = {
  /** Inside a ''' note that continues on the next line. */
  longString: boolean;
  /** Inside a block comment that continues on the next line. */
  blockComment: boolean;
  /** The blocks we are inside, innermost last. */
  blocks: Block[];
  /** A block keyword was read and its `{` has not come yet. */
  pending: Block | null;
  /** How deep inside [settings] we are. */
  settings: number;
  /** How many words the current line has had: in a table, the first is the column and the second its type. */
  words: number;
};

/** The words that open a block or a statement. */
const BLOCKS: Record<string, Block> = {
  project: "project",
  table: "table",
  tablepartial: "table",
  tablegroup: "group",
  enum: "enum",
  ref: "other",
};

/** The names of the settings written between brackets. */
const SETTINGS = new Set([
  "pk",
  "primary",
  "key",
  "not",
  "unique",
  "increment",
  "default",
  "note",
  "ref",
  "name",
  "type",
  "delete",
  "update",
  "color",
  "headercolor",
]);

/** The fixed values a setting can take. */
const VALUES = new Set([
  "null",
  "true",
  "false",
  "cascade",
  "restrict",
  "set",
  "no",
  "action",
  "btree",
  "hash",
]);

const WORD = /^[A-Za-z_][\w$]*/;

/** Reads up to the end of a ''' note, or to the end of the line if it goes on. */
function longString(stream: StringStream, state: State): string {
  while (!stream.eol()) {
    if (stream.match("'''")) {
      state.longString = false;
      return "string";
    }
    stream.next();
  }
  return "string";
}

function blockComment(stream: StringStream, state: State): string {
  while (!stream.eol()) {
    if (stream.match("*/")) {
      state.blockComment = false;
      return "comment";
    }
    stream.next();
  }
  return "comment";
}

/** Reads a quoted text up to its closing quote, skipping escaped characters. */
function quoted(stream: StringStream, quote: string): void {
  let escaped = false;
  while (!stream.eol()) {
    const char = stream.next();
    if (char === quote && !escaped) return;
    escaped = !escaped && char === "\\";
  }
}

function word(text: string, stream: StringStream, state: State): string | null {
  const lower = text.toLowerCase();
  const inside = state.blocks.at(-1);

  if (state.settings > 0) {
    if (SETTINGS.has(lower)) return "keyword";
    return VALUES.has(lower) ? "atom" : null;
  }

  // Note: '…' and indexes { … } can appear inside a table.
  if (lower === "note" || lower === "indexes") {
    if (lower === "indexes") state.pending = "other";
    return "keyword";
  }

  if (inside === undefined || inside === "project") {
    const block = BLOCKS[lower];
    // `Ref: a.b > c.d` is a statement; with a name or alone it opens a block.
    if (block && state.words === 0) {
      state.pending = block;
      state.words++;
      return "keyword";
    }
    if (lower === "as") return "keyword";
    // In a project, a word before a colon is a property: database_type: '…'
    if (inside === "project" && stream.match(/^\s*:/, false)) {
      return "propertyName";
    }
    state.words++;
    return null;
  }

  if (inside === "table") {
    state.words++;
    return state.words === 2 ? "typeName" : null;
  }
  return null;
}

function token(stream: StringStream, state: State): string | null {
  if (stream.sol()) state.words = 0;
  if (state.longString) return longString(stream, state);
  if (state.blockComment) return blockComment(stream, state);
  if (stream.eatSpace()) return null;

  if (stream.match("//")) {
    stream.skipToEnd();
    return "comment";
  }
  if (stream.match("/*")) {
    state.blockComment = true;
    return blockComment(stream, state);
  }
  if (stream.match("'''")) {
    state.longString = true;
    return longString(stream, state);
  }

  const next = stream.peek();
  if (next === "'" || next === '"' || next === "`") {
    stream.next();
    quoted(stream, next);
    // Double quotes hold a name, not a text: "my column" int
    if (next === '"' && state.settings === 0) {
      return word("quoted", stream, state);
    }
    return "string";
  }

  if (stream.match(/^#[0-9a-fA-F]{3,8}\b/)) return "atom";
  if (stream.match(/^-?\d+(\.\d+)?/)) return "number";

  const found = stream.match(WORD);
  if (found && typeof found !== "boolean") {
    return word(found[0], stream, state);
  }

  const char = stream.next();
  if (char === "{") {
    state.blocks.push(state.pending ?? "other");
    state.pending = null;
    return "bracket";
  }
  if (char === "}") {
    state.blocks.pop();
    return "bracket";
  }
  if (char === "[") {
    state.settings++;
    return "bracket";
  }
  if (char === "]") {
    state.settings = Math.max(0, state.settings - 1);
    return "bracket";
  }
  if (char === "<" || char === ">" || char === "-") return "operator";
  return "punctuation";
}

const startState = (): State => ({
  longString: false,
  blockComment: false,
  blocks: [],
  pending: null,
  settings: 0,
  words: 0,
});

/** DBML for CodeMirror: keywords, types, notes, comments, Ref, Enum and TableGroup. */
export const dbmlLanguage = StreamLanguage.define<State>({
  name: "dbml",
  startState,
  copyState: (state) => ({ ...state, blocks: [...state.blocks] }),
  token,
  languageData: {
    commentTokens: { line: "//", block: { open: "/*", close: "*/" } },
    closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`"] },
  },
});

/**
 * The pieces of a DBML text and how each one is highlighted (null for plain
 * text). Blank pieces are left out. For tests and for checking the language.
 */
export function tokenizeDbml(text: string): [string, string | null][] {
  const state = startState();
  const tokens: [string, string | null][] = [];
  for (const line of text.split("\n")) {
    const stream = new StringStream(line, 2, 2);
    while (!stream.eol()) {
      stream.start = stream.pos;
      const style = token(stream, state);
      const piece = stream.current();
      if (piece.trim() !== "") tokens.push([piece, style]);
    }
  }
  return tokens;
}
