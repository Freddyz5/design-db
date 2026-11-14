import { ChevronDown, Eye } from "lucide-react";
import { useTheme } from "../../../shared";
import {
  COLUMNS_FILTERS,
  RELATIONS_FILTERS,
  THEME_OPTIONS,
} from "../../constants/filters";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { usePopover } from "../../hooks/usePopover";
import { viewSummary } from "../../utils/viewSummary";
import { BarButton } from "./BarButton";

type Option<T extends string> = { value: T; label: string; title: string };

/** One choice of the panel: its options as radios, each with what it shows. */
function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
  autoFocus = false,
}: {
  autoFocus?: boolean;
  legend: string;
  name: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col">
      <legend className="px-2.5 pt-2 pb-1 font-display text-[11px] font-semibold tracking-[0.12em] text-ink-muted uppercase">
        {legend}
      </legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-2.5 rounded-[2px] px-2.5 py-1.5 hover:bg-canvas has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent-ink"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            autoFocus={autoFocus && value === option.value}
            className="mt-[3px] size-3.5 flex-none cursor-pointer accent-relation-focus focus-visible:outline-none"
          />
          <span className="flex min-w-0 flex-col">
            <span className="text-[13px] font-medium">{option.label}</span>
            <span className="text-[12px] leading-snug text-ink-muted">
              {option.title}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

/**
 * «Vista»: which columns and which relations the canvas shows. The button
 * says what is filtered, so a hidden column is never a surprise. On a narrow
 * screen, where the bar has no room for the theme selector, the theme is here.
 */
export function ViewMenu() {
  const columns = useEditorStore((state) => state.view.columnsFilter);
  const relations = useEditorStore((state) => state.view.relationsFilter);
  const { open, box, place, toggle } = usePopover("left", 300);
  const [theme, setTheme] = useTheme();
  const summary = viewSummary(columns, relations);

  return (
    <div ref={box} className="relative flex-none">
      <BarButton
        icon={<Eye size={15} strokeWidth={1.75} aria-hidden />}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={
          summary
            ? `Vista: ${summary}`
            : "Qué columnas y relaciones se ven en el lienzo"
        }
        className={summary ? "text-bar-active" : ""}
        onClick={(event) => toggle(event.currentTarget)}
      >
        <span className="max-[1023px]:sr-only">Vista</span>
        {summary && (
          <span className="max-w-36 truncate font-normal text-bar-ink max-[1279px]:sr-only">
            · {summary}
          </span>
        )}
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className="-mr-1 text-bar-muted"
        />
      </BarButton>
      {open && (
        <div
          role="dialog"
          aria-label="Vista"
          className="fixed z-30 flex max-h-[calc(100dvh-64px)] w-[min(300px,calc(100vw-16px))] flex-col overflow-y-auto rounded-control border border-line bg-raised p-1 pb-1.5 text-ink shadow-float"
          style={place}
        >
          <Choice
            autoFocus
            legend="Columnas"
            name="columns-filter"
            options={COLUMNS_FILTERS}
            value={columns}
            onChange={(value) =>
              editorStore.getState().setView({ columnsFilter: value })
            }
          />
          <hr className="mx-2.5 my-1 border-line" />
          <Choice
            legend="Relaciones"
            name="relations-filter"
            options={RELATIONS_FILTERS}
            value={relations}
            onChange={(value) =>
              editorStore.getState().setView({ relationsFilter: value })
            }
          />
          <div className="min-[641px]:hidden">
            <hr className="mx-2.5 my-1 border-line" />
            <Choice
              legend="Tema"
              name="theme-in-view"
              options={THEME_OPTIONS}
              value={theme}
              onChange={setTheme}
            />
          </div>
        </div>
      )}
    </div>
  );
}
