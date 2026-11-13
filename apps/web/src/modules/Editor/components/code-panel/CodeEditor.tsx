import {
  Annotation,
  Compartment,
  EditorState,
  type Extension,
} from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useRef } from "react";
import { codeTheme } from "../../utils/codeTheme";

/** Marks a change that came from the `value` prop, not from the user typing. */
const fromOutside = Annotation.define<boolean>();

type Props = {
  value: string;
  /** The language of the code: how it is highlighted. */
  language: Extension;
  readOnly?: boolean;
  /** Called when the user changes the code, never for a change of `value`. */
  onChange?: (value: string) => void;
  ariaLabel: string;
};

/** A CodeMirror editor that fills its container and follows `value`. */
export function CodeEditor({
  value,
  language,
  readOnly = false,
  onChange,
  ariaLabel,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<EditorView | null>(null);
  const languageSlot = useRef(new Compartment());
  const readOnlySlot = useRef(new Compartment());
  const changed = useRef(onChange);
  changed.current = onChange;

  // The editor is created once; the effects below keep it up to date.
  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          codeTheme,
          languageSlot.current.of(language),
          readOnlySlot.current.of(EditorState.readOnly.of(readOnly)),
          EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
          EditorView.updateListener.of((update) => {
            const typed =
              update.docChanged &&
              !update.transactions.some((tr) => tr.annotation(fromOutside));
            if (typed) changed.current?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    editor.current = view;
    return () => {
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
