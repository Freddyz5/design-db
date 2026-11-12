import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

const OPTIONS = [
  { value: "light", label: "Tema claro", Icon: Sun },
  { value: "dark", label: "Tema oscuro", Icon: Moon },
  { value: "system", label: "Tema del sistema", Icon: Monitor },
] as const;

/** Light, dark or system. Sits on the frame bar. */
export function ThemeSelect() {
  const [theme, setTheme] = useTheme();

  return (
    <fieldset className="flex min-w-0 gap-px rounded-control border border-frame-line bg-frame-well p-px">
      <legend className="sr-only">Tema</legend>
      {OPTIONS.map(({ value, label, Icon }) => (
        <label
          key={value}
          title={label}
          className="grid size-7 cursor-pointer place-items-center rounded-[2px] text-frame-muted hover:text-frame-ink has-checked:bg-frame-deep has-checked:text-lamp has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-lamp"
        >
          <input
            type="radio"
            name="theme"
            value={value}
            checked={theme === value}
            onChange={() => setTheme(value)}
            className="sr-only"
          />
          <Icon size={15} strokeWidth={1.75} aria-hidden />
          <span className="sr-only">{label}</span>
        </label>
      ))}
    </fieldset>
  );
}
