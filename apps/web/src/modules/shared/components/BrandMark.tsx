/**
 * The mark of Design DB: two sheets of a plan joined by a relation, the
 * second one in the cyan of the grid. It takes the color of the text around it.
 */
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="flex-none"
    >
      <rect
        x="2"
        y="3"
        width="8"
        height="10"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M2 6.5h8" stroke="currentColor" strokeWidth="1.6" />
      <rect
        x="14"
        y="11"
        width="8"
        height="10"
        stroke="var(--color-bar-active)"
        strokeWidth="1.6"
      />
      <path d="M14 14.5h8" stroke="var(--color-bar-active)" strokeWidth="1.6" />
      <path d="M10 9c3 0 1 7 4 7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
