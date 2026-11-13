type Option<T extends string> = { value: T; label: string; title: string };

type Props<T extends string> = {
  /** What the choice is about, for screen readers and as the name of the radio group. */
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** A choice of one among a few, on the frame bar. */
export function BarSegment<T extends string>({
  legend,
  options,
  value,
  onChange,
}: Props<T>) {
  return (
    <fieldset className="flex min-w-0 flex-none gap-px rounded-control border border-frame-line bg-frame-well p-px">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          title={option.title}
          className="flex h-7 cursor-pointer items-center rounded-[2px] px-2.5 text-[12.5px] font-medium whitespace-nowrap text-frame-muted hover:text-frame-ink has-checked:bg-frame-deep has-checked:text-lamp has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-lamp"
        >
          <input
            type="radio"
            name={legend}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </fieldset>
  );
}
