/** Monday (YYYY-MM-DD) of the week containing the given date (local). */
export function getWeekStartDateString(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${dayOfMonth}`;
}

/** Most recent scored period ending Saturday before today (matches DB cron). */
export function getLatestScoredPeriod(): { period_start: string; period_end: string } {
  const today = new Date();
  const end = new Date(today);
  const day = end.getDay();
  if (day === 0) {
    end.setDate(end.getDate() - 1);
  } else {
    end.setDate(end.getDate() - day);
  }
  const start = new Date(end);
  start.setDate(start.getDate() - 6);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  return { period_start: fmt(start), period_end: fmt(end) };
}
