import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** A drawn icon, shown before the label. */
  icon?: ReactNode;
  /** The one amber button of the bar. */
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
    ? "border-lamp bg-lamp font-semibold text-on-lamp hover:brightness-105"
    : "border-frame-line bg-frame-well font-medium text-frame-ink hover:border-frame-muted";

  return (
    <button
      type="button"
      className={`inline-flex h-[30px] flex-none cursor-pointer items-center gap-1.5 rounded-control border ${compact ? "px-[11px] max-[1439px]:px-[7px]" : "px-[11px]"} text-[13px] whitespace-nowrap focus-visible:outline-lamp disabled:cursor-default disabled:opacity-45 ${look} ${className ?? ""}`}
      {...rest}
    >
      {icon}
      {compact ? (
        <span className="max-[1439px]:sr-only">{children}</span>
      ) : (
        children
      )}
    </button>
  );
}
