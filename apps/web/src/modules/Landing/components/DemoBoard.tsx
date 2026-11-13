import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_SQL, readDemo, type DemoTable } from "../utils/liveDemo";
import { FlapText } from "./FlapText";

export type DemoTexts = {
  headline: string;
  cta: string;
  repositoryLink: string;
  repository: string;
  lead: string;
  try: string;
  board: {
    label: string;
    table: string;
    columns: string;
    references: string;
    status: string;
    onBoard: string;
    arriving: string;
    empty: string;
  };
  sql: { label: string; ok: string; error: string };
  formats: { title: string; lead: string };
};

/** How long a new table says it is arriving. */
const ARRIVING_MS = 2600;

const ROW =
  "grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)_minmax(0,1.6fr)_minmax(0,1fr)] max-[720px]:grid-cols-[minmax(0,1.5fr)_minmax(0,0.6fr)_minmax(0,1fr)] items-center gap-3 px-5 max-[720px]:px-3";

const references = (table: DemoTable): string =>
  [
    ...new Set(
      table.rows
        .filter((row) => row.detail.startsWith("→"))
        .map((row) => row.detail.slice(2).split(".")[0]!),
    ),
  ].join(", ");

/**
 * The live demo: a departures board with one row per table of the SQL the
 * visitor types, read by the same core the editor uses, and the same schema
 * written as DBML and Drizzle.
 */
export function DemoBoard({ texts }: { texts: DemoTexts }) {
  const [sql, setSql] = useState(DEMO_SQL);
  const deferred = useDeferredValue(sql);
  const result = useMemo(() => readDemo(deferred), [deferred]);

  // The board keeps the last schema that read cleanly while the SQL has errors.
  const [shown, setShown] = useState(() => {
    const first = readDemo(DEMO_SQL);
    return first.ok ? first : null;
  });
  const [arriving, setArriving] = useState<ReadonlySet<string>>(new Set());
  const known = useRef(new Set(shown?.tables.map((t) => t.name) ?? []));

  useEffect(() => {
    if (!result.ok) return;
    setShown(result);
    const names = result.tables.map((t) => t.name);
    const fresh = names.filter((name) => !known.current.has(name));
    known.current = new Set(names);
    if (fresh.length === 0) return;
    setArriving((current) => new Set([...current, ...fresh]));
    const timer = setTimeout(
      () =>
        setArriving((current) => {
          const next = new Set(current);
          for (const name of fresh) next.delete(name);
          return next;
        }),
      ARRIVING_MS,
    );
    return () => clearTimeout(timer);
  }, [result]);

  const status = result.ok
    ? texts.sql.ok
    : texts.sql.error
        .replace("{line}", String(result.line))
        .replace("{message}", result.message);

  return (
    <>
      <section
        aria-label={texts.board.label}
        className="border-2 border-frame-deep bg-flap text-flap-ink shadow-[0_0_0_6px_var(--color-frame-well)]"
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-5 pt-5 pb-4 max-[720px]:px-3">
          <h1 className="flex flex-wrap gap-x-5 gap-y-2">
            {texts.headline
              .toUpperCase()
              .split(" ")
              .map((word, index) => (
                <FlapText
                  key={`${word}-${index}`}
                  text={word}
                  className="flex gap-[3px]"
                  cellClassName="relative grid h-[clamp(40px,6vw,64px)] w-[clamp(28px,4.2vw,46px)] place-items-center rounded-[2px] border border-flap-seam bg-raised font-display text-[clamp(26px,4.2vw,44px)] leading-none font-semibold text-flap-ink after:absolute after:inset-x-0 after:top-1/2 after:h-px after:bg-flap-seam"
                />
              ))}
          </h1>
          <span className="flex-1" />
          <a
            href="/app"
            className="inline-flex h-12 items-center rounded-control bg-lamp px-5 text-[17px] font-semibold text-on-lamp hover:brightness-105"
          >
            {texts.cta}
          </a>
        </div>

        <div
          className={`${ROW} bg-frame py-1.5 font-display text-[12px] font-semibold tracking-[0.14em] text-frame-muted uppercase`}
          aria-hidden
        >
          <span>{texts.board.table}</span>
          <span>{texts.board.columns}</span>
          <span className="max-[720px]:hidden">{texts.board.references}</span>
          <span>{texts.board.status}</span>
        </div>
        <ul aria-live="polite">
          {shown && shown.tables.length > 0 ? (
            shown.tables.map((table) => {
              const isArriving = arriving.has(table.name);
              return (
                <li
                  key={table.id}
                  className={`${ROW} h-[52px] border-t border-frame-deep font-display text-[26px] font-semibold tracking-[0.12em] uppercase shadow-[inset_0_1px_0_var(--color-flap-seam)] max-[720px]:h-11 max-[720px]:text-[19px]`}
                >
                  <FlapText
                    text={table.name.toUpperCase()}
                    className="truncate"
                  />
                  <span className="font-mono text-[20px] tracking-normal max-[720px]:text-[16px]">
                    {table.rows.length}
                  </span>
                  <span className="truncate text-[20px] text-flap-muted max-[720px]:hidden">
                    {references(table)
                      ? `→ ${references(table).toUpperCase()}`
                      : "—"}
                  </span>
                  <FlapText
                    text={(isArriving
                      ? texts.board.arriving
                      : texts.board.onBoard
                    ).toUpperCase()}
                    className={`truncate ${isArriving ? "text-lamp-ink" : "text-flap-muted"}`}
                  />
                </li>
              );
            })
          ) : (
            <li
              className={`${ROW} h-[52px] border-t border-frame-deep text-flap-muted`}
            >
              {texts.board.empty}
            </li>
          )}
        </ul>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,560px)] gap-10 max-[960px]:grid-cols-1">
        <div className="flex flex-col gap-3">
          <p className="max-w-[56ch] text-[21px] leading-snug">{texts.lead}</p>
          <p className="max-w-[56ch] text-[17px] text-ink-muted">{texts.try}</p>
          <a
            href={texts.repository}
            className="mt-1 self-start text-[15px] underline underline-offset-4 hover:text-lamp-ink"
          >
            {texts.repositoryLink}
          </a>
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="demo-sql"
            className="font-display text-[12px] font-semibold tracking-[0.14em] text-ink-muted uppercase"
          >
            {texts.sql.label}
          </label>
          <textarea
            id="demo-sql"
            className="h-72 resize-y rounded-control border border-line bg-panel p-4 font-mono text-[13px] leading-relaxed whitespace-pre text-ink"
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
        </div>
      </div>

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
          <div className="grid grid-cols-2 border border-line max-[960px]:grid-cols-1">
            {(
              [
                ["DBML", shown.dbml],
                ["Drizzle", shown.drizzle],
              ] as const
            ).map(([name, code], index) => (
              <figure
                key={name}
                className={`flex min-w-0 flex-col bg-panel ${index > 0 ? "border-l border-line max-[960px]:border-t max-[960px]:border-l-0" : ""}`}
              >
                <figcaption className="border-b border-line bg-frame px-4 py-2 font-display text-[15px] font-bold tracking-[0.12em] text-frame-ink uppercase">
                  {name}
                </figcaption>
                <pre className="max-h-96 overflow-auto p-4 font-mono text-[12.5px] leading-relaxed text-ink">
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
