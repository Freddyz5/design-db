import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

/** How the code editor looks: the colors and the type of the theme, in both light and dark. */
export const codeTheme: Extension = [
  EditorView.theme({
    "&": {
      height: "100%",
      fontSize: "12.5px",
      color: "var(--color-ink)",
      backgroundColor: "var(--color-panel)",
    },
    "&.cm-focused": {
      outline: "2px solid var(--color-lamp-ink)",
      outlineOffset: "-2px",
    },
    ".cm-scroller": {
      fontFamily: "var(--font-mono)",
      lineHeight: "1.55",
    },
    ".cm-content": { caretColor: "var(--color-lamp-ink)", padding: "8px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-ink)" },
    ".cm-gutters": {
      backgroundColor: "var(--color-panel)",
      color: "var(--color-ink-muted)",
      border: "none",
      borderRight: "1px solid var(--color-line)",
    },
    ".cm-activeLine": {
      backgroundColor: "color-mix(in srgb, var(--color-ink) 5%, transparent)",
    },
    ".cm-activeLineGutter": {
      backgroundColor: "transparent",
      color: "var(--color-ink)",
    },
    "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
      { backgroundColor: "var(--color-code-selection)" },
    ".cm-matchingBracket, &.cm-focused .cm-matchingBracket": {
      backgroundColor: "color-mix(in srgb, var(--color-lamp) 30%, transparent)",
      outline: "none",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: "var(--color-canvas)",
      border: "1px solid var(--color-line)",
      color: "var(--color-ink-muted)",
    },
    ".cm-tooltip": {
      backgroundColor: "var(--color-raised)",
      border: "1px solid var(--color-line)",
      color: "var(--color-ink)",
    },
    ".cm-panels": {
      backgroundColor: "var(--color-panel)",
      color: "var(--color-ink)",
      borderColor: "var(--color-line)",
    },
  }),
  syntaxHighlighting(
    HighlightStyle.define([
      {
        tag: [tags.keyword, tags.operatorKeyword, tags.modifier],
        color: "var(--color-code-keyword)",
        fontWeight: "600",
      },
      {
        tag: [tags.typeName, tags.className, tags.standard(tags.name)],
        color: "var(--color-code-type)",
      },
      {
        tag: [tags.string, tags.special(tags.string)],
        color: "var(--color-code-string)",
      },
      {
        tag: [tags.number, tags.bool, tags.null, tags.atom],
        color: "var(--color-code-number)",
      },
      {
        tag: [tags.comment, tags.lineComment, tags.blockComment],
        color: "var(--color-ink-muted)",
        fontStyle: "italic",
      },
    ]),
  ),
];
