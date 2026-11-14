import { useCallback, useEffect, useRef, useState } from "react";

/** Whether a sideways scroller has more content past its right edge, kept up to date as it scrolls and resizes. */
export function useOverflowEnd() {
  const tools = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);

  const measure = useCallback(() => {
    const box = tools.current;
    if (!box) return;
    setMore(box.scrollLeft + box.clientWidth < box.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const box = tools.current;
    if (!box) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    for (const child of box.children) observer.observe(child);
    return () => observer.disconnect();
  }, [measure]);

  return { tools, more, measure };
}
