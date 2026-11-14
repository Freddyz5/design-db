import type { Group } from "@design-db/core";
import { Check, Pipette } from "lucide-react";
import { useRef } from "react";
import { createPortal } from "react-dom";
import { GROUP_COLOR_NAMES } from "../../constants/groupColors";
import { editorStore } from "../../hooks/useEditorStore";
import { usePopover } from "../../hooks/usePopover";
import { cssColorToHex } from "../../utils/cssColor";
import {
  GROUP_COLOR_KEYS,
  groupColor,
  INTENSITY,
  isHexColor,
} from "../../utils/groupColor";

const SWATCH =
  "relative grid size-6 cursor-pointer place-items-center rounded-[2px] border border-[color-mix(in_srgb,var(--color-ink)_25%,transparent)] aria-pressed:outline-2 aria-pressed:outline-offset-2 aria-pressed:outline-ink focus-visible:outline-accent-ink";

/** The intensity as the panel says it: «120 %». */
const percent = (intensity: number) => `${Math.round(intensity * 100)} %`;

/**
 * The color of a group: a button with its swatch that opens a panel with the
 * eight colors of the palette, a color of one's own, and how strong it is
 * drawn. The canvas shows each change as it happens; a drag of the slider or
 * the color picker is one step to undo.
 */
export function GroupColorPicker({
  group,
  className,
}: {
  group: Group;
  className: string;
}) {
  const { open, setOpen, box, panel, place, toggle } = usePopover("right", 312);
  const swatch = useRef<HTMLSpanElement>(null);
  const intensity = group.intensity ?? 1;
  const custom = isHexColor(group.color) ? group.color : undefined;

  const update = (
    patch: { color?: string; intensity?: number | undefined },
    mergeKey?: string,
  ) =>
    editorStore
      .getState()
      .dispatch(
        { type: "group.update", groupId: group.id, patch },
        mergeKey ? { mergeKey: `${mergeKey}:${group.id}` } : undefined,
      );
  /** Ends a drag, so the next one is its own step. */
  const settle = () => editorStore.getState().checkpoint();

  const setIntensity = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    update(
      { intensity: rounded === 1 ? undefined : rounded },
      "group-intensity",
    );
  };

  /** Where the color picker starts: the color the group has now, as hex. */
  const currentHex = () =>
    custom ??
    (swatch.current
      ? cssColorToHex(getComputedStyle(swatch.current).backgroundColor)
      : "#4f6268");

  return (
    <div ref={box} className="flex">
      <button
        type="button"
        className={`${className} inline-flex items-center gap-1.5`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Color e intensidad del grupo"
        onClick={(event) => {
          if (open) settle();
          toggle(event.currentTarget);
        }}
      >
        <span
          ref={swatch}
          className="size-3 rounded-[2px] border border-[color-mix(in_srgb,var(--color-ink)_25%,transparent)]"
          style={{ backgroundColor: groupColor(group.color) }}
          aria-hidden
        />
        Color
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label={`Color del grupo ${group.name}`}
            className="fixed z-40 flex w-[min(312px,calc(100vw-16px))] flex-col gap-3 rounded-control border border-line bg-raised p-3 text-ink shadow-float"
            style={place}
            onPointerUp={settle}
            onKeyUp={settle}
          >
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 font-display text-[11px] font-semibold tracking-[0.12em] text-ink-muted uppercase">
                Color
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {GROUP_COLOR_KEYS.map((key, index) => (
                  <button
                    key={key}
                    type="button"
                    className={SWATCH}
                    style={{ backgroundColor: groupColor(key) }}
                    aria-label={GROUP_COLOR_NAMES[key]}
                    title={GROUP_COLOR_NAMES[key]}
                    aria-pressed={group.color === key}
                    autoFocus={
                      group.color === key ||
                      (index === 0 &&
                        !GROUP_COLOR_KEYS.includes(group.color as never))
                    }
                    onClick={() => update({ color: key })}
                  >
                    {group.color === key && (
                      <Check
                        size={14}
                        strokeWidth={2.5}
                        className="text-on-group"
                        aria-hidden
                      />
                    )}
                  </button>
                ))}
                {/* A color of one's own, with the system's picker. */}
                <label
                  className={`${SWATCH} has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent-ink ${custom ? "outline-2 outline-offset-2 outline-ink" : "bg-panel text-ink-muted hover:text-ink"}`}
                  style={
                    custom ? { backgroundColor: groupColor(custom) } : undefined
                  }
                  title="Color personalizado"
                >
                  <input
                    type="color"
                    className="sr-only"
                    aria-label="Color personalizado"
                    value={currentHex()}
                    onChange={(event) =>
                      update({ color: event.target.value }, "group-color")
                    }
                    onBlur={settle}
                  />
                  {custom ? (
                    <Check
                      size={14}
                      strokeWidth={2.5}
                      className="text-on-group"
                      aria-hidden
                    />
                  ) : (
                    <Pipette size={14} strokeWidth={1.75} aria-hidden />
                  )}
                </label>
              </div>
              {custom && (
                <p className="text-[12px] text-ink-muted">
                  Personalizado{" "}
                  <span className="font-mono text-ink">{custom}</span>
                </p>
              )}
            </fieldset>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor={`intensity-${group.id}`}
                  className="font-display text-[11px] font-semibold tracking-[0.12em] text-ink-muted uppercase"
                >
                  Intensidad
                </label>
                <span className="font-mono text-[12px] tabular-nums">
                  {percent(intensity)}
                </span>
              </div>
              <input
                id={`intensity-${group.id}`}
                type="range"
                min={INTENSITY.min}
                max={INTENSITY.max}
                step={INTENSITY.step}
                value={intensity}
                aria-valuetext={percent(intensity)}
                className="w-full cursor-pointer accent-relation-focus"
                onChange={(event) => setIntensity(Number(event.target.value))}
                onBlur={settle}
              />
              <div className="flex items-center justify-between text-[12px] text-ink-muted">
                <span>Más tenue</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-[2px] px-1 text-ink underline decoration-line underline-offset-2 hover:decoration-ink disabled:cursor-default disabled:text-ink-muted disabled:no-underline"
                  disabled={intensity === 1}
                  onClick={() => update({ intensity: undefined })}
                >
                  Restablecer
                </button>
                <span>Más fuerte</span>
              </div>
            </div>

            <button
              type="button"
              className="sr-only focus:not-sr-only focus:self-end focus:text-[12px]"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}
