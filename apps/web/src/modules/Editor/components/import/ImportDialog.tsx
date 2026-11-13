import type { MergeMode } from "@design-db/core";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { selectDiagram } from "../../hooks/EditorStore";
import { useImport } from "../../hooks/useImport";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { readTextFile, SCHEMA_FILE_TYPES } from "../../utils/readTextFile";
import {
  previewImport,
  SCHEMA_FORMAT_NAMES,
  type ImportPreview,
} from "../../utils/schemaImport";

const BUTTON =
  "inline-flex h-[30px] cursor-pointer items-center rounded-control border px-3 text-[13px] whitespace-nowrap disabled:cursor-default disabled:opacity-45 border-line bg-raised hover:border-ink-muted";

/** The one primary action: amber. */
const PRIMARY =
  "inline-flex h-[30px] cursor-pointer items-center rounded-control border px-3 text-[13px] whitespace-nowrap disabled:cursor-default disabled:opacity-45 border-lamp bg-lamp font-semibold text-on-lamp hover:brightness-105";

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** What the dialog says about the text before importing it. */
function previewText(preview: ImportPreview, hasTables: boolean): string {
  if (!preview.ok) {
    const [first] = preview.errors;
    if (!first) return "";
    return first.line > 0
      ? `Línea ${first.line}: ${first.message}`
      : first.message;
  }
  const parts = [
    SCHEMA_FORMAT_NAMES[preview.format],
    count(preview.tables, "tabla", "tablas"),
    count(preview.relations, "relación", "relaciones"),
  ];
  if (preview.groups > 0) parts.push(count(preview.groups, "grupo", "grupos"));
  if (hasTables && preview.existing > 0) {
    parts.push(
      `${count(preview.existing, "ya existe", "ya existen")} en el diagrama`,
    );
  }
  return parts.join(" · ");
}

/** The dialog to paste or open a schema in SQL, DBML, Drizzle or the project JSON, and import it. */
export function ImportDialog() {
  const text = useEditorStore((state) => state.view.importText);
  if (text === null) return null;
  return <ImportDialogBody initial={text} />;
}

function ImportDialogBody({ initial }: { initial: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const infoId = useId();
  const diagram = useEditorStore(selectDiagram);
  const hasTables = diagram.tables.length > 0;
  const [text, setText] = useState(initial);
  const [mode, setMode] = useState<MergeMode>(hasTables ? "add" : "replace");
  const [busy, setBusy] = useState(false);
  const runImport = useImport();

  const preview = useMemo(
    () => (text.trim() ? previewImport(diagram, text) : null),
    [diagram, text],
  );
  const ready = preview?.ok === true && !busy;

  useEffect(() => {
    dialog.current?.showModal();
    area.current?.focus();
  }, []);

  const close = () => editorStore.getState().setView({ importText: null });

  const confirm = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      await runImport(text, mode);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="m-auto flex max-h-[calc(100dvh-32px)] w-[min(760px,calc(100vw-32px))] flex-col rounded-control border border-line bg-panel text-ink shadow-float backdrop:bg-frame-deep/50"
      onClose={close}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <header className="flex flex-col gap-1 px-5 pt-4 pb-2">
        <h2
          id={titleId}
          className="font-display text-[22px] font-bold tracking-[0.04em] uppercase"
        >
          Importar esquema
        </h2>
        <p className="text-[13px] text-ink-muted">
          Pega SQL (PostgreSQL o MySQL), DBML, un esquema de Drizzle o un
          proyecto .json de Design DB. El formato se detecta solo.
        </p>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-5 py-2">
        <textarea
          ref={area}
          className="min-h-64 flex-1 resize-y rounded-control border border-line bg-raised p-2.5 font-mono text-[12.5px] leading-normal whitespace-pre"
          aria-label="Esquema para importar"
          aria-describedby={infoId}
          spellCheck={false}
          placeholder={
            "CREATE TABLE clientes (\n  id serial PRIMARY KEY,\n  nombre varchar(120) NOT NULL\n);"
          }
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void confirm();
            }
          }}
        />
        <p
          id={infoId}
          aria-live="polite"
          className={`min-h-5 text-[13px] ${preview === null ? "text-ink-muted" : preview.ok ? "text-added" : "text-removed"}`}
        >
          {preview === null
            ? "Puedes pegar el texto o abrir un archivo."
            : previewText(preview, hasTables)}
        </p>
      </div>
      <footer className="flex flex-wrap items-center gap-2 px-5 pt-2 pb-4">
        <fieldset className="flex flex-wrap gap-4 text-[13px]">
          <legend className="sr-only">Cómo importar</legend>
          {(
            [
              ["add", "Agregar al diagrama"],
              ["replace", "Reemplazar todo"],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className="flex cursor-pointer items-center gap-1.5"
            >
              <input
                type="radio"
                name="import-mode"
                className="accent-lamp-ink"
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <span className="flex-1" />
        <label className={BUTTON}>
          Abrir archivo…
          <input
            type="file"
            accept={SCHEMA_FILE_TYPES}
            className="sr-only"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) setText(await readTextFile(file));
            }}
          />
        </label>
        <button type="button" className={BUTTON} onClick={close}>
          Cancelar
        </button>
        <button
          type="button"
          className={PRIMARY}
          disabled={!ready}
          onClick={() => void confirm()}
        >
          {busy ? "Importando…" : "Importar"}
        </button>
      </footer>
    </dialog>
  );
}
