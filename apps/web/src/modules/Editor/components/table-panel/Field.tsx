import type { Issue } from "@design-db/core";
import type { ReactNode } from "react";
import { ISSUE_MESSAGES } from "../../constants/issueMessages";

/** The look of a text input or a select in a panel. */
export const INPUT =
  "h-[30px] w-full min-w-0 rounded-control border border-line bg-raised px-2 text-[13px] text-ink placeholder:text-ink-muted aria-invalid:border-removed";

/** The look of a button in a panel. */
export const BUTTON =
  "h-[30px] cursor-pointer rounded-control border border-line bg-raised px-2.5 text-[13px] whitespace-nowrap hover:border-ink-muted disabled:cursor-default disabled:opacity-45 disabled:hover:border-line";

export const CHECKBOX =
  "size-4 cursor-pointer accent-lamp-ink disabled:cursor-default";

/** The problems of a field, each in its own line. Errors in red, warnings in amber. */
export function IssueList({
  issues,
}: {
  issues: readonly Issue[] | undefined;
}) {
  if (!issues || issues.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5 text-[12px] leading-snug">
      {issues.map((issue, index) => (
        <li
          key={`${issue.code}-${index}`}
          className={
            issue.severity === "error" ? "text-removed" : "text-changed"
          }
        >
          {ISSUE_MESSAGES[issue.code]}
        </li>
      ))}
    </ul>
  );
}

/** A labelled control, with its problems under it. */
export function Field({
  label,
  issues,
  className,
  children,
}: {
  label: string;
  issues?: readonly Issue[];
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex min-w-0 flex-1 flex-col gap-1 ${className ?? ""}`}>
      <span className="font-display text-[11.5px] font-semibold tracking-[0.08em] text-ink-muted uppercase">
        {label}
      </span>
      {children}
      <IssueList issues={issues} />
    </label>
  );
}
