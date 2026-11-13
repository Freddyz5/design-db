import { useRef } from "react";

type Props = {
  text: string;
  /** Classes for each character cell. */
  cellClassName?: string;
  className?: string;
  /** Flip the characters when the text first appears too, not only when it changes. */
  animateOnMount?: boolean;
  /** Always draw one cell per character, as a headline set in flaps does, even before any change. */
  cells?: boolean;
  title?: string;
};

/**
 * Text set in flap cells, like a departures board. When the text changes,
 * its characters flip one after another; under reduced motion it just
 * changes. Until then it renders as plain text, so a large diagram stays cheap.
 */
export function FlapText({
  text,
  cellClassName = "inline-block",
  className = "",
  animateOnMount = false,
  cells = false,
  title,
}: Props) {
  const version = useRef(animateOnMount ? 1 : 0);
  const last = useRef(text);
  if (last.current !== text) {
    last.current = text;
    version.current++;
  }

  const animated = version.current > 0;
  if (!animated && !cells) {
    return (
      <span className={className} title={title}>
        {text}
      </span>
    );
  }

  return (
    <span className={className} title={title} aria-label={text}>
      {[...text].map((char, index) => (
        <span
          // A new key replays the flip for every character of the new text.
          key={`${version.current}-${index}`}
          aria-hidden
          className={`${animated ? "flap-cell " : ""}${cellClassName}`}
          style={animated ? { animationDelay: `${index * 22}ms` } : undefined}
        >
          {char === " " ? " " : char}
        </span>
      ))}
    </span>
  );
}
