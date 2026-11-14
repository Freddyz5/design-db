import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** A drawn icon, shown before the label. */
  icon?: ReactNode;
  /** The one orange button of the bar. */
  primary?: boolean;
  /** On narrow screens only the icon shows; the label stays for screen readers and the tooltip. */
  compact?: boolean;
};

/** A button on the frame bar. */
export function BarButton({
  icon,
  primary,
  compact,
  className,
  children,
  ...rest
}: Props) {
  const look = primary
    ? "border-accent bg-accent font-semibold text-on-accent hover:brightness-105"
    : "border-bar-line bg-bar-well font-medium text-bar-ink hover:border-bar-muted";

  return (
    <button
      type="button"
      className={`inline-flex h-[30px] flex-none cursor-pointer items-center gap-1.5 rounded-control border ${compact ? "px-[11px] max-[1023px]:px-[7px]" : "px-[11px]"} text-[13px] whitespace-nowrap focus-visible:outline-accent disabled:cursor-default disabled:opacity-45 ${look} ${className ?? ""}`}
      {...rest}
    >
      {icon}
      {compact ? (
        <span className="max-[1023px]:sr-only">{children}</span>
      ) : (
        children
      )}
    </button>
  );
}
