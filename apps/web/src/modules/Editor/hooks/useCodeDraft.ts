import type { ImportIssue } from "@design-db/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LineIssue } from "../components/code-panel/CodeEditor";
import { applyCode } from "../utils/codeEdits";
import type { CodeFormat } from "../utils/codeFormats";
import { drawnSizes } from "../utils/canvasElements";
import { layoutUnplaced } from "../utils/autoLayout";
import { browserLayouter } from "../utils/elkWorker";
import { selectDiagram } from "./EditorStore";
import { editorStore } from "./useEditorStore";

/** How long after the last key the code is read. */
const IDLE_MS = 700;

/** Where the code of the panel stands. */
export type CodeStatus =
  | { kind: "idle" }
  | { kind: "typing" }
  | { kind: "applied"; warnings: number }
  | { kind: "error"; line: number; message: string; count: number };

const toLineIssues = (
  issues: readonly ImportIssue[],
  severity: LineIssue["severity"],
): LineIssue[] =>
  issues.map((issue) => ({
    line: issue.line,
    message: issue.message,
    severity,
  }));

/**
 * The code the user is typing in the panel, applied to the diagram once they
 * stop. While the code has errors the diagram is left alone and the errors
 * are marked on their lines. New tables are laid out next to the others, in
 * the same undo step.
 *
 * The typed text stays in the editor while it has focus, so the code is not
 * rewritten under the cursor. When the editor loses focus with code that
 * applied cleanly, the panel shows the generated code again.
 */
export function useCodeDraft(format: CodeFormat) {
  const [draft, setDraft] = useState<string | null>(null);
  const [issues, setIssues] = useState<LineIssue[]>([]);
  const [status, setStatus] = useState<CodeStatus>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Counts the reads, so the result of an old one is dropped. */
  const run = useRef(0);
  const hasFocus = useRef(false);
  const latest = useRef<string | null>(null);

  const stopTimer = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };

  const apply = useCallback(
    async (text: string): Promise<boolean> => {
      const id = ++run.current;
      const state = editorStore.getState();
      const base = selectDiagram(state);
      const result = applyCode(base, text, format);

      if (!result.ok) {
        const [first] = result.errors;
        setIssues(toLineIssues(result.errors, "error"));
        setStatus({
          kind: "error",
          line: first?.line ?? 1,
          message: first?.message ?? "",
          count: result.errors.length,
        });
        return false;
      }

      let next = result.diagram;
      if (result.unplaced.length > 0) {
        const positions = await layoutUnplaced(
          next,
          drawnSizes(next, state.view.columnsFilter),
          browserLayouter(),
        );
        // Something newer happened while the worker ran: drop this one.
        if (
          id !== run.current ||
          selectDiagram(editorStore.getState()) !== base
        ) {
          return false;
        }
        next = {
          ...next,
          layout: {
            ...next.layout,
            tables: { ...next.layout.tables, ...positions },
          },
        };
      }
      if (next !== base) editorStore.getState().replace(next);
      setIssues(toLineIssues(result.warnings, "warning"));
      setStatus({ kind: "applied", warnings: result.warnings.length });
      return true;
    },
    [format],
  );

  const onChange = useCallback(
    (text: string) => {
      latest.current = text;
      setDraft(text);
      setStatus({ kind: "typing" });
      stopTimer();
      timer.current = setTimeout(() => {
        timer.current = null;
        void apply(text);
      }, IDLE_MS);
    },
    [apply],
  );

  /** Puts the generated code back and forgets what was typed. */
  const discard = useCallback(() => {
    stopTimer();
    run.current++;
    latest.current = null;
    setDraft(null);
    setIssues([]);
    setStatus({ kind: "idle" });
  }, []);

  const onFocusChange = useCallback(
    async (focused: boolean) => {
      hasFocus.current = focused;
      if (focused || latest.current === null) return;
      // Leaving the editor reads what is pending right away.
      const pending = timer.current !== null;
      stopTimer();
      const ok = pending
        ? await apply(latest.current)
        : status.kind !== "error";
      if (ok && !hasFocus.current) discard();
    },
    [apply, discard, status.kind],
  );

  // Another format writes other code: what was typed no longer fits it.
  useEffect(() => discard, [format, discard]);

  return { draft, issues, status, onChange, onFocusChange, discard };
}
