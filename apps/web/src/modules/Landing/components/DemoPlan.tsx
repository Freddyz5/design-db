import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_SQL, readDemo, type DemoTable } from "../utils/liveDemo";

export type DemoTexts = {
  headline: string;
  cta: string;
  repositoryLink: string;
  repository: string;
  lead: string;
  try: string;
  plan: {
    label: string;
    name: string;
    added: string;
    empty: string;
    titleBlock: { plan: string; scale: string; content: string; state: string };
  };
  sql: { label: string; ok: string; error: string };
  formats: { title: string; lead: string };
};

/** How long a new table is marked as new. */
const NEW_MS = 2600;

/** The drawing paper: a fine cyan grid and a bolder one every five squares. */
const PAPER =
  "bg-canvas bg-[linear-gradient(var(--color-grid-major)_1px,transparent_1px),linear-gradient(90deg,var(--color-grid-major)_1px,transparent_1px),linear-gradient(var(--color-grid)_1px,transparent_1px),linear-gradient(90deg,var(--color-grid)_1px,transparent_1px)] bg-size-[100px_100px,100px_100px,20px_20px,20px_20px]";

const LABEL =
  "border-r border-sheet-rule px-2 py-[3px] font-display text-[10px] font-semibold tracking-[0.12em] text-sheet-muted uppercase";
const CELL = "min-w-0 truncate px-2 py-[3px] font-mono text-[11px]";

const relationsOf = (table: DemoTable): number =>
  table.rows.filter((row) => row.detail.startsWith("→")).length;

/** One table of the demo, drawn as the editor draws it: a technical sheet. */
function Sheet({
  table,
  isNew,
  added,
}: {
  table: DemoTable;
  isNew: boolean;
  added: string;
}) {
  return (
    <figure
      className={`m-0 w-[min(100%,290px)] border-[1.5px] border-sheet-edge bg-sheet text-sheet-ink ${isNew ? "outline-2 outline-offset-[3px] outline-accent" : ""}`}
    >
      <figcaption className="flex items-center justify-between gap-2 border-b-[1.5px] border-sheet-edge bg-sheet-head px-2 py-1 font-display text-[15px] font-bold tracking-[0.04em] text-sheet-head-ink">
        <span className="truncate">{table.name}</span>
        {isNew ? (
          <span className="rounded-[2px] bg-added px-1 text-[10.5px] leading-4 tracking-[0.1em] text-sheet uppercase">
            {added}
          </span>
        ) : (
          <span className="font-mono text-[11px] font-medium opacity-80">
            {table.rows.length}
          </span>
        )}
      </figcaption>
      <ul>
        {table.rows.map((row) => (
          <li
            key={row.name}
            className={`grid grid-cols-[34%_28%_38%] border-t border-sheet-rule font-mono text-[11px] first:border-t-0 ${row.key ? "bg-key" : ""}`}
          >
            <span className="truncate px-[5px] py-[3px]">{row.name}</span>
            <span className="truncate border-l border-sheet-rule px-[5px] py-[3px] text-sheet-muted">
              {row.type}
            </span>
            <span
              className={`truncate border-l border-sheet-rule px-[5px] py-[3px] ${row.key ? "font-semibold text-key-ink" : row.detail.startsWith("→") ? "font-semibold text-relation-focus" : "text-sheet-muted"}`}
            >
              {row.detail}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * The live demo: a sheet of drawing paper where the tables of the SQL the
 * visitor types are drawn as the editor draws them, read by the same core,
 * under a title block. Below, the same schema written as DBML and Drizzle.
 */
export function DemoPlan({ texts }: { texts: DemoTexts }) {
  const [sql, setSql] = useState(DEMO_SQL);
  const deferred = useDeferredValue(sql);
  const result = useMemo(() => readDemo(deferred), [deferred]);

  // The plan keeps the last schema that read cleanly while the SQL has errors.
  const [shown, setShown] = useState(() => {
    const first = readDemo(DEMO_SQL);
    return first.ok ? first : null;
  });
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const known = useRef(new Set(shown?.tables.map((t) => t.name) ?? []));

  useEffect(() => {
    if (!result.ok) return;
    setShown(result);
    const names = result.tables.map((t) => t.name);
    const added = names.filter((name) => !known.current.has(name));
    known.current = new Set(names);
    if (added.length === 0) return;
    setFresh((current) => new Set([...current, ...added]));
    const timer = setTimeout(
      () =>
        setFresh((current) => {
          const next = new Set(current);
          for (const name of added) next.delete(name);
          return next;
        }),
      NEW_MS,
    );
    return () => clearTimeout(timer);
  }, [result]);

  const status = result.ok
    ? texts.sql.ok
    : texts.sql.error
        .replace("{line}", String(result.line))
        .replace("{message}", result.message);
  const tables = shown?.tables ?? [];
  const relations = tables.reduce((sum, table) => sum + relationsOf(table), 0);
  const { titleBlock } = texts.plan;

  return (
    <>
      {/* The drawing sheet: an inked border with a second frame inside, as on a printed plan. */}
      <section
        aria-label={texts.plan.label}
        className="border-[1.5px] border-sheet-edge bg-sheet p-1.5"
      >
        <div
          className={`flex flex-col gap-8 border border-sheet-edge p-8 max-[720px]:p-4 ${PAPER}`}
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex max-w-[60ch] flex-col gap-3">
              <h1 className="font-display text-[clamp(40px,7vw,84px)] leading-[0.9] font-bold tracking-[0.02em] text-ink uppercase">
                {texts.headline}
              </h1>
              <p className="text-[20px] leading-snug text-ink">{texts.lead}</p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href="/app"
                className="inline-flex h-12 items-center rounded-control bg-accent px-5 text-[17px] font-semibold text-on-accent hover:brightness-105"
              >
                {texts.cta}
              </a>
              <a
                href={texts.repository}
                className="text-[15px] text-ink underline underline-offset-4 hover:text-accent-ink"
              >
                {texts.repositoryLink}
              </a>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-8 max-[960px]:grid-cols-1">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="demo-sql"
                className="font-display text-[12px] font-semibold tracking-[0.14em] text-ink-muted uppercase"
              >
                {texts.sql.label}
              </label>
              <textarea
                id="demo-sql"
                className="h-80 resize-y border-[1.5px] border-sheet-edge bg-sheet p-4 font-mono text-[13px] leading-relaxed whitespace-pre text-sheet-ink"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                value={sql}
                onChange={(event) => setSql(event.target.value)}
                aria-describedby="demo-sql-status"
              />
              <p
                id="demo-sql-status"
                className={`flex items-center gap-2 text-[13px] ${result.ok ? "text-ink-muted" : "text-removed"}`}
              >
                <span
                  className={`size-[7px] flex-none rounded-full ${result.ok ? "bg-added" : "bg-removed"}`}
                  aria-hidden
                />
                {status}
              </p>
              <p className="mt-2 max-w-[48ch] text-[15px] text-ink-muted">
                {texts.try}
              </p>
            </div>

            <div className="flex min-w-0 flex-col justify-between gap-6">
              <div
                className="flex flex-wrap content-start items-start gap-5"
                aria-live="polite"
              >
                {tables.length > 0 ? (
                  tables.map((table) => (
                    <Sheet
                      key={table.id}
                      table={table}
                      isNew={fresh.has(table.name)}
                      added={texts.plan.added}
                    />
                  ))
                ) : (
                  <p className="text-ink-muted">{texts.plan.empty}</p>
                )}
              </div>
              <dl className="grid w-72 grid-cols-[auto_minmax(0,1fr)] self-end border-[1.5px] border-sheet-edge bg-sheet text-sheet-ink max-[480px]:w-full">
                <dt className={`${LABEL} border-b`}>{titleBlock.plan}</dt>
                <dd
                  className={`${CELL} m-0 border-b border-sheet-rule font-display text-[12.5px] font-bold`}
                >
                  {texts.plan.name}
                </dd>
                <dt className={`${LABEL} border-b`}>{titleBlock.scale}</dt>
                <dd className={`${CELL} m-0 border-b border-sheet-rule`}>
                  1 : 1
                </dd>
                <dt className={`${LABEL} border-b`}>{titleBlock.content}</dt>
                <dd className={`${CELL} m-0 border-b border-sheet-rule`}>
                  {tables.length} {tables.length === 1 ? "tabla" : "tablas"} ·{" "}
                  {relations} {relations === 1 ? "relación" : "relaciones"}
                </dd>
                <dt className={LABEL}>{titleBlock.state}</dt>
                <dd
                  className={`${CELL} m-0 ${result.ok ? "" : "text-removed"}`}
                >
                  {result.ok ? texts.sql.ok : `Línea ${result.line}`}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </section>

      {shown && (
        <section
          className="flex flex-col gap-5 pt-14"
          aria-labelledby="formats-title"
        >
          <div className="flex flex-col gap-2">
            <h2
              id="formats-title"
              className="font-display text-[36px] leading-none font-bold tracking-[0.03em] uppercase"
            >
              {texts.formats.title}
            </h2>
            <p className="max-w-[64ch] text-[17px] text-ink-muted">
              {texts.formats.lead}
            </p>
          </div>
          <div className="grid grid-cols-2 border-[1.5px] border-sheet-edge max-[960px]:grid-cols-1">
            {(
              [
                ["DBML", shown.dbml],
                ["Drizzle", shown.drizzle],
              ] as const
            ).map(([name, code], index) => (
              <figure
                key={name}
                className={`m-0 flex min-w-0 flex-col bg-sheet ${index > 0 ? "border-l border-sheet-edge max-[960px]:border-t max-[960px]:border-l-0" : ""}`}
              >
                <figcaption className="border-b border-sheet-edge bg-sheet-head px-4 py-2 font-display text-[15px] font-bold tracking-[0.12em] text-sheet-head-ink uppercase">
                  {name}
                </figcaption>
                <pre className="m-0 max-h-96 overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-sheet-ink">
                  {code}
                </pre>
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
