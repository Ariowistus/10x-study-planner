import type { SessionStatus } from "./types";

export interface AgendaEntry {
  topicId: string;
  topicTitle: string;
  date: string;
  startTime?: string | null;
  minutes: number;
  status: SessionStatus;
}

export function timeInMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function endsWithinDay(time: string, minutes: number): boolean {
  return timeInMinutes(time) + minutes <= 1440;
}

export function timeRange(time: string | null | undefined, minutes: number): string {
  if (!time) return "Bez godziny";
  const end = timeInMinutes(time) + minutes;
  return `${time.slice(0, 5)}–${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}`;
}

export function compareEntries(a: AgendaEntry, b: AgendaEntry): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99") ||
    a.topicTitle.localeCompare(b.topicTitle, "pl")
  );
}

/** Each week's denominator is its real entries, never a stale topic estimate. */
export function summarizeAgenda(entries: readonly AgendaEntry[]) {
  const groups = new Map<
    string,
    { id: string; title: string; total: number; done: number; count: number; completed: number }
  >();
  for (const entry of entries) {
    const group = groups.get(entry.topicId) ?? {
      id: entry.topicId,
      title: entry.topicTitle,
      total: 0,
      done: 0,
      count: 0,
      completed: 0,
    };
    group.count += 1;
    group.total += entry.minutes;
    if (entry.status === "done") {
      group.done += entry.minutes;
      group.completed += 1;
    }
    groups.set(entry.topicId, group);
  }
  return [...groups.values()].map((group) => ({ ...group, percent: Math.round((group.done / group.total) * 100) }));
}
