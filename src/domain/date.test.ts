import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  differenceInDays,
  endOfMonth,
  parseIsoDate,
  startOfMonth,
  startOfWeek,
  toIsoDate,
  weekdayIndex,
} from "./date";

describe("parseIsoDate", () => {
  it("parses a calendar date at UTC midnight", () => {
    expect(parseIsoDate("2026-09-14").toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("rejects anything that is not a plain YYYY-MM-DD date", () => {
    expect(() => parseIsoDate("14-09-2026")).toThrow(/YYYY-MM-DD/);
    expect(() => parseIsoDate("2026-09-14T10:00:00Z")).toThrow(/YYYY-MM-DD/);
    expect(() => parseIsoDate("")).toThrow(/YYYY-MM-DD/);
  });

  it("rejects a well-formed string that is not a real date", () => {
    expect(() => parseIsoDate("2026-13-01")).toThrow(/valid calendar date/);
  });
});

describe("toIsoDate", () => {
  it("round-trips through parseIsoDate", () => {
    expect(toIsoDate(parseIsoDate("2026-02-29"))).toBe("2026-03-01");
    expect(toIsoDate(parseIsoDate("2026-09-14"))).toBe("2026-09-14");
  });
});

describe("addDays", () => {
  it("moves forward and backward", () => {
    expect(addDays("2026-09-14", 3)).toBe("2026-09-17");
    expect(addDays("2026-09-14", -1)).toBe("2026-09-13");
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("differenceInDays", () => {
  it("counts whole days in both directions", () => {
    expect(differenceInDays("2026-09-14", "2026-09-18")).toBe(4);
    expect(differenceInDays("2026-09-18", "2026-09-14")).toBe(-4);
    expect(differenceInDays("2026-09-14", "2026-09-14")).toBe(0);
  });

  it("is unaffected by daylight saving transitions", () => {
    // Europe changes clocks on 2026-10-25; the day count must stay whole.
    expect(differenceInDays("2026-10-24", "2026-10-26")).toBe(2);
  });
});

describe("weekdayIndex", () => {
  it("treats Monday as zero and Sunday as six", () => {
    expect(weekdayIndex("2026-09-14")).toBe(0); // Monday
    expect(weekdayIndex("2026-09-17")).toBe(3); // Thursday
    expect(weekdayIndex("2026-09-20")).toBe(6); // Sunday
  });
});

describe("startOfWeek", () => {
  it("returns the Monday of the containing week", () => {
    expect(startOfWeek("2026-09-17")).toBe("2026-09-14");
    expect(startOfWeek("2026-09-20")).toBe("2026-09-14"); // Sunday belongs to the week before
    expect(startOfWeek("2026-09-14")).toBe("2026-09-14");
  });
});

describe("startOfMonth", () => {
  it("returns the first day of the containing month", () => {
    expect(startOfMonth("2026-09-13")).toBe("2026-09-01");
    expect(startOfMonth("2026-09-01")).toBe("2026-09-01");
    expect(startOfMonth("2026-12-31")).toBe("2026-12-01");
  });
});

describe("endOfMonth", () => {
  it("returns the last day of the containing month", () => {
    expect(endOfMonth("2026-09-13")).toBe("2026-09-30");
    expect(endOfMonth("2026-01-01")).toBe("2026-01-31");
  });

  it("knows February in a leap year and outside one", () => {
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29");
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
  });
});

describe("addMonths", () => {
  it("moves forward and backward", () => {
    expect(addMonths("2026-09-13", 1)).toBe("2026-10-13");
    expect(addMonths("2026-09-13", -1)).toBe("2026-08-13");
  });

  it("crosses year boundaries", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("clamps onto the last day when the target month is shorter", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("is a no-op for zero", () => {
    expect(addMonths("2026-09-13", 0)).toBe("2026-09-13");
  });
});
