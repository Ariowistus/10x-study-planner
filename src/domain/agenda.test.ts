import { describe, expect, it } from "vitest";
import { compareEntries, endsWithinDay, summarizeAgenda, timeRange, type AgendaEntry } from "./agenda";
const entry = {
  topicId: "english",
  topicTitle: "Angielski",
  date: "2026-09-14",
  minutes: 60,
  status: "planned" as const,
};
describe("calendar agenda", () => {
  it("counts both repeated English blocks before reporting completion", () => {
    const [summary] = summarizeAgenda([{ ...entry, status: "done" }, entry]);
    expect(summary).toMatchObject({ total: 120, done: 60, percent: 50, count: 2, completed: 1 });
    expect(summarizeAgenda([{ ...entry, status: "planned" }, entry])[0].percent).toBe(0);
  });
  it("keeps skipped work in the denominator rather than counting it as completed", () => {
    expect(
      summarizeAgenda([
        { ...entry, status: "done" },
        { ...entry, status: "skipped" },
      ])[0].percent,
    ).toBe(50);
    expect(summarizeAgenda([])).toEqual([]);
  });
  it("orders days and hours chronologically with untimed entries last", () => {
    const entries: AgendaEntry[] = [
      { ...entry },
      { ...entry, startTime: "14:00" },
      { ...entry, startTime: "09:00" },
      { ...entry, date: "2026-09-13" },
    ];
    expect(entries.sort(compareEntries).map((e) => e.startTime ?? e.date)).toEqual([
      "2026-09-13",
      "09:00",
      "14:00",
      "2026-09-14",
    ]);
  });
  it("formats times and handles the midnight boundary", () => {
    expect(timeRange("09:00", 90)).toBe("09:00–10:30");
    expect(timeRange("23:00", 60)).toBe("23:00–24:00");
    expect(timeRange(null, 60)).toBe("Bez godziny");
    expect(endsWithinDay("23:00", 60)).toBe(true);
    expect(endsWithinDay("23:00", 61)).toBe(false);
  });
});
