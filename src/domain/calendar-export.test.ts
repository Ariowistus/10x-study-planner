import { describe, expect, it } from "vitest";
import { exportCalendar } from "./calendar-export";

const session = { id: "abc", topicTitle: "Sieci", date: "2026-12-31", minutes: 60, status: "planned" as const };
const stamp = "20260913T120000Z";

describe("calendar export", () => {
  it("preserves dates across a year boundary without inventing a timezone or hour", () => {
    const result = exportCalendar([session], stamp);
    expect(result).toContain("DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101");
    expect(result).toContain("SUMMARY:Sieci (60 min)");
    expect(result).toContain("UID:abc@10x-study-planner");
    expect(result.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
  it("exports only remaining planned sessions", () => {
    const result = exportCalendar(
      [
        { ...session, status: "done" },
        { ...session, status: "skipped" },
      ],
      stamp,
    );
    expect(result).not.toContain("BEGIN:VEVENT");
  });
  it("escapes titles so they cannot inject calendar properties", () => {
    const result = exportCalendar([{ ...session, topicTitle: "Sieci, DNS; TCP\\IP\nLOCATION:evil" }], stamp);
    expect(result).toContain("SUMMARY:Sieci\\, DNS\\; TCP\\\\IP\\nLOCATION:evil");
    expect(result).not.toContain("\r\nLOCATION:");
  });
  it("folds long Polish titles within the UTF-8 byte limit without losing text", () => {
    const title = "Żółć i ćwiczenia ".repeat(12);
    const result = exportCalendar([{ ...session, topicTitle: title }], stamp);
    for (const line of result.split("\r\n")) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
    expect(result.replaceAll("\r\n ", "")).toContain(`SUMMARY:${title} (60 min)`);
  });
});
