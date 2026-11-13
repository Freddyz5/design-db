import { useRef } from "react";

type Props = {
  text: string;
  /** Classes for each character cell. */
  cellClassName?: string;
  className?: string;
};

/**
 * Text set in flap cells. When the text changes, its characters flip one
 * after another, like a departures board; under reduced motion it just changes.
 */
export function FlapText({
  text,
  cellClassName = "inline-block",
  className = "",
}: Props) {
  const version = useRef(0);
  const last = useRef(text);
  if (last.current !== text) {
    last.current = text;
    version.current++;
  }

  return (
    <span className={className} aria-label={text}>
      {[...text].map((char, index) => (
        <span
          // A new key replays the flip for every character of the new text.
          key={`${version.current}-${index}`}
          aria-hidden
          className={`flap-cell ${cellClassName}`}
          style={{ animationDelay: `${index * 22}ms` }}
        >
          {char === " " ? "\u00a0" : char}
        </span>
      ))}
    </span>
  );
}
