import type { NodeProps } from "@xyflow/react";
import { memo, useState } from "react";
import { GROUP_COLOR_NAMES } from "../../constants/groupColors";
import { editorStore } from "../../hooks/useEditorStore";
import type { GroupNode } from "../../utils/canvasElements";
import { GROUP_COLOR_KEYS, stripColors } from "../../utils/groupColor";

const ACTION =
  "h-6 cursor-pointer rounded-[2px] border border-line bg-raised px-2 text-[11.5px] hover:border-ink-muted";

const count = (n: number): string => `${n} ${n === 1 ? "tabla" : "tablas"}`;

/**
 * A group on the canvas: a region in its color behind its tables, with its
 * name on top. Dragging the name moves the tables. The actions show when the
 * pointer is over the name.
 */
export const GroupNodeView = memo(function GroupNodeView({
  data,
}: NodeProps<GroupNode>) {
  const { group, color } = data;
  const [draft, setDraft] = useState<string | null>(null);

  const rename = () => {
    const name = draft?.trim();
    setDraft(null);
    if (name && name !== group.name) {
      editorStore.getState().dispatch({
        type: "group.update",
        groupId: group.id,
        patch: { name },
      });
    }
  };

  const remove = () => {
    const { dispatch, notify } = editorStore.getState();
    dispatch({ type: "group.remove", groupId: group.id });
    notify(`Desagrupaste ${group.name}.`);
  };

  return (
    <div
      className="size-full rounded-[4px] border"
      style={{
        borderColor: `color-mix(in srgb, ${color} 60%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${color} 9%, transparent)`,
      }}
    >
      <div className="group-handle group/label pointer-events-auto relative cursor-grab px-4 pt-3 pb-1 active:cursor-grabbing">
        <div className="min-w-0">
          {draft === null ? (
            <div
              className="truncate font-display text-[20px] leading-tight font-bold tracking-[0.08em] uppercase"
              title="Doble clic para cambiar el nombre"
              onDoubleClick={() => setDraft(group.name)}
            >
              {group.name}
            </div>
          ) : (
            <input
              className="nodrag h-7 w-56 rounded-control border border-line bg-raised px-1.5 font-display text-[18px] font-bold tracking-[0.06em]"
              aria-label="Nombre del grupo"
              value={draft}
              autoFocus
              onFocus={(event) => event.target.select()}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={rename}
              onKeyDown={(event) => {
                if (event.key === "Enter") rename();
                if (event.key === "Escape") setDraft(null);
              }}
            />
          )}
          <div className="font-display text-[12px] font-semibold tracking-[0.08em] whitespace-nowrap text-ink-muted uppercase">
            {count(data.count)}
          </div>
          {group.note && (
            <p className="mt-0.5 max-w-[66ch] truncate text-[12px] text-ink-muted">
              {group.note}
            </p>
          )}
        </div>
        {/* The actions sit just above the region, so they never cover its name. */}
        <div className="nodrag absolute right-0 bottom-full flex cursor-default items-center gap-1 pb-1 whitespace-nowrap opacity-0 transition-opacity duration-100 group-hover/label:opacity-100 focus-within:opacity-100">
          <div
            className="mr-1 flex gap-0.5"
            role="group"
            aria-label="Color del grupo"
          >
            {GROUP_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                className="size-4 cursor-pointer rounded-[2px] border border-flap-edge aria-pressed:outline-2 aria-pressed:outline-offset-1 aria-pressed:outline-ink"
                style={{ backgroundColor: stripColors(key).background }}
                aria-label={`Color ${GROUP_COLOR_NAMES[key]}`}
                title={`Color ${GROUP_COLOR_NAMES[key]}`}
                aria-pressed={group.color === key}
                onClick={() =>
                  editorStore.getState().dispatch({
                    type: "group.update",
                    groupId: group.id,
                    patch: { color: key },
                  })
                }
              />
            ))}
          </div>
          <button
            type="button"
            className={ACTION}
            onClick={() => setDraft(group.name)}
          >
            Renombrar
          </button>
          <button
            type="button"
            className={ACTION}
            title="Quita el grupo; sus tablas se quedan"
            onClick={remove}
          >
            Desagrupar
          </button>
        </div>
      </div>
    </div>
  );
});
