import { javascript } from "@codemirror/lang-javascript";
import {
  MySQL,
  PostgreSQL,
  SQLite,
  StandardSQL,
  sql,
  type SQLDialect,
} from "@codemirror/lang-sql";
import type { Extension } from "@codemirror/state";
import type { Dialect } from "@design-db/core";
import { Check, ChevronsRight, Copy, Download } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { selectDiagram } from "../../hooks/EditorStore";
import { useCodeDraft, type CodeStatus } from "../../hooks/useCodeDraft";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import {
  CODE_FORMATS,
  DIALECT_NAMES,
  FORMAT_NAMES,
  codeFileName,
  dialectChoices,
  formatLabel,
  generateCode,
  type CodeFormat,
} from "../../utils/codeFormats";
import { dbmlLanguage } from "../../utils/dbmlLanguage";
import { CodeEditor } from "./CodeEditor";

const SQL_DIALECTS: Record<Dialect, SQLDialect> = {
  postgres: PostgreSQL,
  mysql: MySQL,
  sqlite: SQLite,
  generic: StandardSQL,
};

const CONTROL =
  "h-7 cursor-pointer rounded-[2px] border border-line bg-raised px-2 text-[12.5px] whitespace-nowrap hover:border-ink-muted";

const ICON_BUTTON =
  "grid size-7 flex-none cursor-pointer place-items-center rounded-[2px] text-ink-muted hover:bg-canvas hover:text-ink";

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

/** How the code of a format is highlighted. */
function languageOf(format: CodeFormat, dialect: Dialect): Extension {
  if (format === "sql") return sql({ dialect: SQL_DIALECTS[dialect] });
  return format === "drizzle" ? javascript({ typescript: true }) : dbmlLanguage;
}

/** What the footer of the panel says. */
function statusText(status: CodeStatus): string {
  switch (status.kind) {
    case "typing":
      return "El diagrama se actualiza al dejar de escribir…";
    case "applied":
      return status.warnings === 0
        ? "Diagrama actualizado."
        : status.warnings === 1
          ? "Diagrama actualizado, con 1 aviso: pasa el puntero por la línea marcada."
          : `Diagrama actualizado, con ${status.warnings} avisos: pasa el puntero por las líneas marcadas.`;
    case "error":
      return `Línea ${status.line}: ${status.message}${status.count > 1 ? ` (y ${status.count - 1} más)` : ""}. El diagrama no cambió.`;
    default:
      return "Escribe aquí: el diagrama se actualiza al dejar de escribir.";
  }
}

/** The diagram as code, next to the canvas: SQL, DBML or Drizzle, to read, edit, copy or download. */
export function CodePanel() {
  const diagram = useEditorStore(selectDiagram);
  const format = useEditorStore((state) => state.view.codeFormat);
  const width = useEditorStore((state) => state.view.codeWidth);
  const { dialect } = diagram;
  const [copied, setCopied] = useState(false);

  const generated = useMemo(
    () => generateCode(diagram, format),
    [diagram, format],
  );
  const { draft, issues, status, onChange, onFocusChange, discard } =
    useCodeDraft(format);
  const code = draft ?? generated;
  const language = useMemo(
    () => languageOf(format, dialect),
    [format, dialect],
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);

  const { setView, dispatch } = editorStore.getState();
  const pick = (next: CodeFormat) => setView({ codeFormat: next });

  /** Left and right move between the tabs, as in any tab list. */
  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const at = CODE_FORMATS.indexOf(format);
    const next =
      CODE_FORMATS[(at + step + CODE_FORMATS.length) % CODE_FORMATS.length]!;
    pick(next);
    event.currentTarget
      .querySelector<HTMLElement>(`[data-format="${next}"]`)
      ?.focus();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // The browser refused: the code can still be selected and copied by hand.
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([code], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = codeFileName(diagram, format);
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside
      aria-label="Código"
      className="flex min-w-0 flex-none flex-col border-l border-line bg-panel max-[900px]:absolute max-[900px]:inset-x-0 max-[900px]:bottom-0 max-[900px]:z-10 max-[900px]:h-[55%] max-[900px]:!w-auto max-[900px]:border-t max-[900px]:border-l-0 max-[900px]:shadow-float"
      style={{ width }}
    >
      <div className="flex min-w-0 items-center gap-1.5 border-b border-line px-2 py-1.5">
        <div
          role="tablist"
          aria-label="Formato del código"
          className="flex min-w-0 gap-0.5"
          onKeyDown={onTabKey}
        >
          {CODE_FORMATS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              data-format={item}
              aria-selected={item === format}
              tabIndex={item === format ? 0 : -1}
              className="h-7 cursor-pointer rounded-[2px] px-2.5 font-display text-[13px] font-semibold tracking-[0.06em] whitespace-nowrap text-ink-muted uppercase hover:text-ink aria-selected:bg-canvas aria-selected:text-ink aria-selected:shadow-[inset_0_-2px_0_var(--color-lamp-ink)]"
              onClick={() => pick(item)}
            >
              {FORMAT_NAMES[item]}
            </button>
          ))}
        </div>
        <span className="flex-1" />
        {format !== "dbml" && (
          <select
            className={CONTROL}
            aria-label="Dialecto"
            title="Para qué base de datos se escribe el código"
            value={dialect}
            onChange={(event) =>
              dispatch({
                type: "diagram.update",
                patch: { dialect: event.target.value as Dialect },
              })
            }
          >
            {dialectChoices(dialect).map((choice) => (
              <option key={choice} value={choice}>
                {DIALECT_NAMES[choice]}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          className={ICON_BUTTON}
          aria-label="Copiar el código"
          title="Copiar el código"
          onClick={copy}
        >
          {copied ? <Check {...ICON} /> : <Copy {...ICON} />}
        </button>
        <span className="sr-only" aria-live="polite">
          {copied ? "Código copiado" : ""}
        </span>
        <button
          type="button"
          className={ICON_BUTTON}
          aria-label="Descargar el código"
          title={`Descargar ${codeFileName(diagram, format)}`}
          onClick={download}
        >
          <Download {...ICON} />
        </button>
        <button
          type="button"
          className={ICON_BUTTON}
          aria-label="Ocultar el código"
          title="Ocultar el código"
          onClick={() => setView({ codeOpen: false })}
        >
          <ChevronsRight {...ICON} />
        </button>
      </div>
      <div role="tabpanel" className="min-h-0 flex-1">
        <CodeEditor
          value={code}
          language={language}
          issues={issues}
          onChange={onChange}
          onFocusChange={(focused) => void onFocusChange(focused)}
          ariaLabel={`Código en ${formatLabel(format, dialect)}`}
        />
      </div>
      <footer
        className={`flex min-h-8 items-center gap-2 border-t border-line px-2.5 py-1.5 text-[12px] ${status.kind === "error" ? "bg-code-error text-removed" : "text-ink-muted"}`}
      >
        <span
          className={`size-[7px] flex-none rounded-full ${status.kind === "error" ? "bg-removed" : status.kind === "applied" && status.warnings > 0 ? "bg-changed" : "bg-added"}`}
          aria-hidden
        />
        <span className="min-w-0 flex-1" role="status">
          {statusText(status)}
        </span>
        {draft !== null && status.kind === "error" && (
          <button
            type="button"
            className="flex-none cursor-pointer underline underline-offset-2"
            onClick={discard}
          >
            Descartar cambios
          </button>
        )}
      </footer>
    </aside>
  );
}
