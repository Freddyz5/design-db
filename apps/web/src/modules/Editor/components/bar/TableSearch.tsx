import { useReactFlow } from "@xyflow/react";
import { Search } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { selectDiagram } from "../../hooks/EditorStore";
import { editorStore, useEditorStore } from "../../hooks/useEditorStore";
import { moveActive, searchItems } from "../../utils/tableSearch";

const fitDuration = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 250;

/** Whether the user is typing somewhere: then "/" is a character, not a shortcut. */
function isTyping(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.closest("input, textarea, select, .cm-editor") !== null)
  );
}

/** Finds a table by its name or by a column, and shows it. Opens with "/". */
export function TableSearch() {
  const diagram = useEditorStore(selectDiagram);
  const { fitView } = useReactFlow();
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [place, setPlace] = useState<CSSProperties>({});

  const items = useMemo(() => searchItems(diagram, query), [diagram, query]);
  const showList = open && query.trim() !== "";

  // "/" anywhere outside a field puts the cursor in the search.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey)
        return;
      if (isTyping(event.target)) return;
      event.preventDefault();
      input.current?.focus();
      input.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!showList || !input.current) return;
    const rect = input.current.getBoundingClientRect();
    setPlace({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 240),
    });
  }, [showList]);

  const pick = (tableId: string) => {
    editorStore.getState().setView({ selection: [tableId] });
    void fitView({
      nodes: [{ id: tableId }],
      padding: 0.6,
      maxZoom: 1,
      duration: fitDuration(),
    });
    setQuery("");
    setOpen(false);
    setActive(-1);
    input.current?.blur();
  };

  return (
    <div className="relative flex-none">
      <Search
        size={14}
        strokeWidth={1.75}
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-frame-muted"
      />
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Buscar tabla"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          showList && active >= 0 ? `${listId}-${active}` : undefined
        }
        placeholder="Buscar tabla"
        title="Buscar tabla (/)"
        autoComplete="off"
        spellCheck={false}
        className="h-[30px] w-40 rounded-control border border-frame-line bg-frame-well pr-2 pl-7 text-[13px] text-frame-ink placeholder:text-frame-muted max-[1439px]:w-32 [&::-webkit-search-cancel-button]:appearance-none"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            setActive((current) =>
              moveActive(
                current,
                event.key === "ArrowDown" ? 1 : -1,
                items.length,
              ),
            );
          } else if (event.key === "Enter") {
            const item = items[active] ?? items[0];
            if (item) {
              event.preventDefault();
              pick(item.tableId);
            }
          } else if (event.key === "Escape") {
            if (query) setQuery("");
            else input.current?.blur();
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Tablas encontradas"
          className="fixed z-30 max-h-80 overflow-y-auto rounded-control border border-line bg-raised p-1 text-ink shadow-float"
          style={place}
        >
          {items.length === 0 ? (
            <li className="px-2.5 py-1.5 text-[12.5px] text-ink-muted">
              Ninguna tabla coincide.
            </li>
          ) : (
            items.map((item, index) => (
              <li
                key={item.tableId}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className="flex cursor-pointer items-baseline justify-between gap-3 rounded-[2px] px-2.5 py-1.5 aria-selected:bg-canvas"
                // Picking happens before the input loses focus and closes the list.
                onMouseDown={(event) => {
                  event.preventDefault();
                  pick(item.tableId);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span className="font-mono text-[12.5px]">{item.name}</span>
                {item.hint && (
                  <span className="truncate text-[11.5px] text-ink-muted">
                    {item.hint}
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
