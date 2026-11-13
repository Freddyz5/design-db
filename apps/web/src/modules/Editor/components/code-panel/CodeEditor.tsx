import { lintGutter, setDiagnostics, type Diagnostic } from "@codemirror/lint";
import {
  Annotation,
  Compartment,
  EditorState,
  RangeSetBuilder,
  StateEffect,
  StateField,
  type Extension,
} from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { codeTheme } from "../../utils/codeTheme";

/** Marks a change that came from the `value` prop, not from the user typing. */
const fromOutside = Annotation.define<boolean>();

/** Lines of the code, counted from 0, both ends included. */
export type LineRange = { start: number; end: number };

/** Where to take the reader: the cursor goes on `line`, and `top` is scrolled to the top. Lines from 0. */
export type CodeReveal = { line: number; top: number; focus: boolean };

/** How long the cursor rests before the editor says which line it is on. */
const CURSOR_REST = 120;

const setMarked = StateEffect.define<LineRange | null>();
const MARKED_LINE = Decoration.line({ class: "cm-markedLine" });

/** The marked lines, as line decorations. They follow the edits until marked again. */
const markedLines = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(lines, tr) {
    let next = lines.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setMarked)) continue;
      const builder = new RangeSetBuilder<Decoration>();
      const range = effect.value;
      if (range) {
        const last = Math.min(range.end + 1, tr.state.doc.lines);
        for (
          let number = Math.max(range.start + 1, 1);
          number <= last;
          number++
        ) {
          const line = tr.state.doc.line(number);
          builder.add(line.from, line.from, MARKED_LINE);
        }
      }
      next = builder.finish();
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

/** The number of a line, from 1, kept inside the document. */
const lineNumber = (state: EditorState, line: number) =>
  Math.min(Math.max(line + 1, 1), state.doc.lines);

/** A problem in the code, on a line counted from 1. */
export type LineIssue = {
  line: number;
  message: string;
  severity: "error" | "warning";
};

type Props = {
  value: string;
  /** The language of the code: how it is highlighted. */
  language: Extension;
  readOnly?: boolean;
  /** Problems to mark on their lines. */
  issues?: readonly LineIssue[];
  /** Lines to mark, such as those of the selected table. */
  marked?: LineRange | null;
  /** Where to take the reader. A new object takes them there again. */
  reveal?: CodeReveal | null;
  /** The line the cursor rests on while the editor has the focus; null when it loses it. */
  onCursorLine?: (line: number | null) => void;
  /** Called when the user changes the code, never for a change of `value`. */
  onChange?: (value: string) => void;
  onFocusChange?: (focused: boolean) => void;
  ariaLabel: string;
};

/** The problems as CodeMirror diagnostics, each on its whole line. */
function toDiagnostics(
  state: EditorState,
  issues: readonly LineIssue[],
): Diagnostic[] {
  return issues.map((issue) => {
    const number = Math.min(Math.max(issue.line, 1), state.doc.lines);
    const line = state.doc.line(number);
    return {
      from: line.from,
      to: line.to,
      severity: issue.severity,
      message: issue.message,
    };
  });
}

/** A CodeMirror editor that fills its container and follows `value`. */
export function CodeEditor({
  value,
  language,
  readOnly = false,
  issues = [],
  marked = null,
  reveal = null,
  onChange,
  onFocusChange,
  onCursorLine,
  ariaLabel,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const languageSlot = useRef(new Compartment());
  const readOnlySlot = useRef(new Compartment());
  const changed = useRef(onChange);
  changed.current = onChange;
  const focused = useRef(onFocusChange);
  focused.current = onFocusChange;
  const cursorMoved = useRef(onCursorLine);
  cursorMoved.current = onCursorLine;
  const cursorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The editor is created once; the effects below keep it up to date.
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          lintGutter(),
          codeTheme,
          markedLines,
          languageSlot.current.of(language),
          readOnlySlot.current.of(EditorState.readOnly.of(readOnly)),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.updateListener.of((update) => {
            const typed =
              update.docChanged &&
              !update.transactions.some((tr) => tr.annotation(fromOutside));
            if (typed) changed.current?.(update.state.doc.toString());
            if (update.focusChanged) focused.current?.(update.view.hasFocus);
            if (!update.selectionSet && !update.focusChanged) return;
            clearTimeout(cursorTimer.current);
            if (!update.view.hasFocus) {
              if (update.focusChanged) cursorMoved.current?.(null);
              return;
            }
            cursorTimer.current = setTimeout(() => {
              const { state } = update.view;
              const head = state.selection.main.head;
              cursorMoved.current?.(state.doc.lineAt(head).number - 1);
            }, CURSOR_REST);
          }),
        ],
      }),
    });
    editor.current = view;
    return () => {
      clearTimeout(cursorTimer.current);
      view.destroy();
      editor.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
      annotations: fromOutside.of(true),
    });
  }, [value]);

  useEffect(() => {
    const view = editor.current;
    if (!view) return;
    view.dispatch(
      setDiagnostics(view.state, toDiagnostics(view.state, issues)),
    );
  }, [issues, value]);

  // After the text: the lines are counted in the new one.
  useEffect(() => {
    editor.current?.dispatch({ effects: setMarked.of(marked) });
  }, [marked, value]);

  useEffect(() => {
    const view = editor.current;
    if (!view || !reveal) return;
    const { state } = view;
    const line = state.doc.line(lineNumber(state, reveal.line));
    const top = state.doc.line(lineNumber(state, reveal.top));
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(top.from, { y: "start", yMargin: 40 }),
    });
    if (reveal.focus) view.focus();
  }, [reveal]);

  useEffect(() => {
    editor.current?.dispatch({
      effects: languageSlot.current.reconfigure(language),
    });
  }, [language]);

  useEffect(() => {
    editor.current?.dispatch({
      effects: readOnlySlot.current.reconfigure(
        EditorState.readOnly.of(readOnly),
      ),
    });
  }, [readOnly]);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" />;
}
