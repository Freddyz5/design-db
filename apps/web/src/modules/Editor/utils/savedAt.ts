const TIME = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
});
const DAY = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });

/** When a diagram was saved, as the list says it: the time if it was today, the day otherwise. */
export function savedAt(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === now.toDateString()
    ? TIME.format(date)
    : DAY.format(date);
}
