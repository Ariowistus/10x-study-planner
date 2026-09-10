import { describe, expect, it } from "vitest";

import { weekdayIndex } from "./date";
import {
  DEFAULT_MIN_BLOCK_MINUTES,
  generatePlan,
  isSchedulable,
  remainingCapacity,
  remainingMinutes,
  urgencyScore,
} from "./scheduler";
import type { Availability, Topic } from "./types";

/** A Monday. Every test plans this week. */
const MONDAY = "2026-09-14";

const NO_AVAILABILITY: Availability = [0, 0, 0, 0, 0, 0, 0];
const HOUR_EVERY_DAY: Availability = [60, 60, 60, 60, 60, 60, 60];

function topic(overrides: Partial<Topic> & Pick<Topic, "id">): Topic {
  return {
    title: `Topic ${overrides.id}`,
    estimatedMinutes: 120,
    completedMinutes: 0,
    priority: 3,
    deadline: null,
    status: "active",
    ...overrides,
  };
}

function minutesOn(sessions: readonly { date: string; minutes: number }[], date: string): number {
  return sessions.filter((s) => s.date === date).reduce((sum, s) => sum + s.minutes, 0);
}

function minutesForTopic(sessions: readonly { topicId: string; minutes: number }[], topicId: string): number {
  return sessions.filter((s) => s.topicId === topicId).reduce((sum, s) => sum + s.minutes, 0);
}

describe("input validation", () => {
  it("rejects a week that does not start on a Monday", () => {
    expect(() => generatePlan({ weekStart: "2026-09-15", topics: [], availability: HOUR_EVERY_DAY })).toThrow(/Monday/);
  });

  it("rejects a non-positive minimum block", () => {
    expect(() =>
      generatePlan({
        weekStart: MONDAY,
        topics: [],
        availability: HOUR_EVERY_DAY,
        minBlockMinutes: 0,
      }),
    ).toThrow(/positive/);
  });

  it("accepts an empty topic list", () => {
    const plan = generatePlan({ weekStart: MONDAY, topics: [], availability: HOUR_EVERY_DAY });

    expect(plan.sessions).toEqual([]);
    expect(plan.unscheduledMinutes).toBe(0);
  });
});

describe("topic eligibility", () => {
  it("counts remaining work as the estimate minus what is done", () => {
    expect(remainingMinutes(topic({ id: "a", estimatedMinutes: 120, completedMinutes: 45 }))).toBe(75);
  });

  it("never reports negative remaining work when a topic is overshot", () => {
    expect(remainingMinutes(topic({ id: "a", estimatedMinutes: 60, completedMinutes: 90 }))).toBe(0);
  });

  it("excludes topics that are finished, archived or fully covered", () => {
    expect(isSchedulable(topic({ id: "a", status: "done" }))).toBe(false);
    expect(isSchedulable(topic({ id: "b", status: "archived" }))).toBe(false);
    expect(isSchedulable(topic({ id: "c", estimatedMinutes: 60, completedMinutes: 60 }))).toBe(false);
    expect(isSchedulable(topic({ id: "d" }))).toBe(true);
  });

  // US-014
  it("schedules nothing for a topic whose work is already complete", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "covered", estimatedMinutes: 120, completedMinutes: 120 })],
      availability: HOUR_EVERY_DAY,
    });

    expect(plan.sessions).toEqual([]);
  });
});

describe("urgency score", () => {
  // US-009
  it("ranks a near deadline above a distant one", () => {
    const soon = topic({ id: "soon", deadline: "2026-09-17" });
    const later = topic({ id: "later", deadline: "2026-10-14" });

    expect(urgencyScore(soon, MONDAY, 120)).toBeGreaterThan(urgencyScore(later, MONDAY, 120));
  });

  it("ranks a deadline topic above an important topic with no deadline", () => {
    const deadlineBound = topic({ id: "exam", priority: 1, deadline: "2026-09-17" });
    const important = topic({ id: "important", priority: 5, deadline: null });

    expect(urgencyScore(deadlineBound, MONDAY, 120)).toBeGreaterThan(urgencyScore(important, MONDAY, 300));
  });

  it("treats an overdue deadline as maximally urgent", () => {
    const overdue = topic({ id: "overdue", deadline: "2026-09-01" });
    const dueToday = topic({ id: "today", deadline: MONDAY });

    expect(urgencyScore(overdue, MONDAY, 120)).toBe(urgencyScore(dueToday, MONDAY, 120));
  });

  it("uses priority to separate topics under equal time pressure", () => {
    const high = topic({ id: "high", priority: 5 });
    const low = topic({ id: "low", priority: 1 });

    expect(urgencyScore(high, MONDAY, 120)).toBeGreaterThan(urgencyScore(low, MONDAY, 120));
  });

  it("grows as remaining work grows", () => {
    const t = topic({ id: "a" });

    expect(urgencyScore(t, MONDAY, 300)).toBeGreaterThan(urgencyScore(t, MONDAY, 60));
  });
});

describe("capacity", () => {
  // SC-2, the core invariant
  it("never schedules a day beyond its declared availability", () => {
    const availability: Availability = [30, 90, 0, 45, 120, 15, 240];
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [
        topic({ id: "a", estimatedMinutes: 600 }),
        topic({ id: "b", estimatedMinutes: 400, priority: 5 }),
        topic({ id: "c", estimatedMinutes: 300, deadline: "2026-09-18" }),
      ],
      availability,
    });

    for (let offset = 0; offset < 7; offset += 1) {
      const date = ["14", "15", "16", "17", "18", "19", "20"][offset];
      const iso = `2026-09-${date}`;
      expect(minutesOn(plan.sessions, iso)).toBeLessThanOrEqual(availability[weekdayIndex(iso)]);
    }
  });

  // US-007
  it("leaves a zero-availability day empty", () => {
    const availability: Availability = [60, 60, 0, 60, 60, 60, 60];
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 600 })],
      availability,
    });

    // Wednesday of that week
    expect(minutesOn(plan.sessions, "2026-09-16")).toBe(0);
    expect(plan.sessions.length).toBeGreaterThan(0);
  });

  it("schedules nothing when no time is available at all", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 300 })],
      availability: NO_AVAILABILITY,
    });

    expect(plan.sessions).toEqual([]);
    expect(plan.unscheduledMinutes).toBe(300);
  });

  it("never gives a topic more minutes than it has left", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "small", estimatedMinutes: 90, completedMinutes: 30 })],
      availability: HOUR_EVERY_DAY,
    });

    expect(minutesForTopic(plan.sessions, "small")).toBe(60);
    expect(plan.unscheduledMinutes).toBe(0);
  });
});

describe("blocks", () => {
  it("does not emit a session shorter than the minimum block", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 600 })],
      availability: [10, 10, 10, 10, 10, 10, 10],
      minBlockMinutes: 15,
    });

    expect(plan.sessions).toEqual([]);
    expect(plan.unscheduledMinutes).toBe(600);
  });

  it("allows a short final block when it finishes a topic", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "tail", estimatedMinutes: 5 })],
      availability: HOUR_EVERY_DAY,
      minBlockMinutes: 15,
    });

    expect(plan.sessions).toHaveLength(1);
    expect(plan.sessions[0].minutes).toBe(5);
  });

  it("leaves capacity below the minimum block unused", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 600 })],
      availability: [50, 0, 0, 0, 0, 0, 0],
      minBlockMinutes: 20,
    });

    // 50 minutes of capacity yields two 20-minute blocks; the last 10 are dropped.
    expect(minutesOn(plan.sessions, MONDAY)).toBe(40);
  });

  it("emits one merged session per topic per day", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 600 })],
      availability: [180, 0, 0, 0, 0, 0, 0],
      minBlockMinutes: 15,
    });

    const monday = plan.sessions.filter((s) => s.date === MONDAY);
    expect(monday).toHaveLength(1);
    expect(monday[0].minutes).toBe(180);
  });

  it("defaults the minimum block to fifteen minutes", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 600 })],
      availability: [DEFAULT_MIN_BLOCK_MINUTES - 1, 0, 0, 0, 0, 0, 0],
    });

    expect(plan.sessions).toEqual([]);
  });
});

describe("allocation", () => {
  // US-010
  it("splits a topic larger than one day across several days", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "big", estimatedMinutes: 240 })],
      availability: HOUR_EVERY_DAY,
    });

    expect(plan.sessions).toHaveLength(4);
    expect(minutesForTopic(plan.sessions, "big")).toBe(240);
    expect(new Set(plan.sessions.map((s) => s.date)).size).toBe(4);
  });

  // US-009 end to end through the planner
  it("gives the week's deadline topic time before a topic due next month", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [
        topic({ id: "distant", estimatedMinutes: 300, deadline: "2026-10-14" }),
        topic({ id: "thisweek", estimatedMinutes: 120, deadline: "2026-09-18" }),
      ],
      availability: HOUR_EVERY_DAY,
    });

    const firstSession = plan.sessions[0];
    expect(firstSession.topicId).toBe("thisweek");

    // and the urgent topic is finished before its deadline
    const urgentDates = plan.sessions
      .filter((s) => s.topicId === "thisweek")
      .map((s) => s.date)
      .sort();
    expect(urgentDates[urgentDates.length - 1] <= "2026-09-18").toBe(true);
  });

  it("interleaves topics that are under comparable pressure", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [
        topic({ id: "a", estimatedMinutes: 300, priority: 3 }),
        topic({ id: "b", estimatedMinutes: 300, priority: 3 }),
      ],
      availability: [240, 0, 0, 0, 0, 0, 0],
      minBlockMinutes: 30,
    });

    const monday = plan.sessions.filter((s) => s.date === MONDAY);
    expect(monday.map((s) => s.topicId).sort()).toEqual(["a", "b"]);
    expect(minutesOn(plan.sessions, MONDAY)).toBe(240);
  });

  it("reports work that did not fit in the week", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 600 })],
      availability: [60, 60, 0, 0, 0, 0, 0],
    });

    expect(minutesForTopic(plan.sessions, "a")).toBe(120);
    expect(plan.unscheduledMinutes).toBe(480);
  });
});

describe("remainingCapacity", () => {
  it("keeps the whole week when it is still ahead", () => {
    expect(remainingCapacity(HOUR_EVERY_DAY, MONDAY, MONDAY)).toEqual([60, 60, 60, 60, 60, 60, 60]);
  });

  it("zeroes days that have already passed", () => {
    // Planning on the Thursday of that week.
    expect(remainingCapacity(HOUR_EVERY_DAY, MONDAY, "2026-09-17")).toEqual([0, 0, 0, 60, 60, 60, 60]);
  });

  it("leaves nothing when the week is over", () => {
    expect(remainingCapacity(HOUR_EVERY_DAY, MONDAY, "2026-09-28")).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("does not invent capacity on a day the learner kept free", () => {
    const availability: Availability = [60, 0, 60, 60, 60, 60, 60];

    expect(remainingCapacity(availability, MONDAY, "2026-09-16")).toEqual([0, 0, 60, 60, 60, 60, 60]);
  });

  it("stops the planner from filling evenings that are gone", () => {
    const plan = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 600 })],
      availability: remainingCapacity(HOUR_EVERY_DAY, MONDAY, "2026-09-18"),
    });

    const dates = plan.sessions.map((session) => session.date);
    expect(dates.every((date) => date >= "2026-09-18")).toBe(true);
    expect(dates).toHaveLength(3);
  });
});

describe("determinism", () => {
  // SC-3 relies on this: the same state must always replan the same way.
  it("produces an identical plan for identical input", () => {
    const input = {
      weekStart: MONDAY,
      topics: [
        topic({ id: "a", estimatedMinutes: 200, priority: 4, deadline: "2026-09-20" }),
        topic({ id: "b", estimatedMinutes: 150, priority: 2 }),
        topic({ id: "c", estimatedMinutes: 90, priority: 5, deadline: "2026-09-16" }),
      ],
      availability: [45, 60, 30, 90, 0, 120, 60] as Availability,
    };

    expect(generatePlan(input)).toEqual(generatePlan(input));
  });

  it("breaks ties by topic id so ordering never depends on input order", () => {
    const forward = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a" }), topic({ id: "b" })],
      availability: [30, 0, 0, 0, 0, 0, 0],
      minBlockMinutes: 30,
    });
    const reversed = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "b" }), topic({ id: "a" })],
      availability: [30, 0, 0, 0, 0, 0, 0],
      minBlockMinutes: 30,
    });

    expect(forward.sessions).toEqual(reversed.sessions);
    expect(forward.sessions[0].topicId).toBe("a");
  });
});

describe("recomputation after progress", () => {
  // US-012 and SC-3: completing work changes the next plan.
  it("plans less for a topic once some of its work is done", () => {
    const before = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 240 })],
      availability: HOUR_EVERY_DAY,
    });
    const after = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 240, completedMinutes: 120 })],
      availability: HOUR_EVERY_DAY,
    });

    expect(minutesForTopic(before.sessions, "a")).toBe(240);
    expect(minutesForTopic(after.sessions, "a")).toBe(120);
  });

  // US-013: skipping returns the work to the pool rather than consuming it.
  it("keeps skipped work in the pool for the next generation", () => {
    const skipped = generatePlan({
      weekStart: MONDAY,
      topics: [topic({ id: "a", estimatedMinutes: 240, completedMinutes: 0 })],
      availability: HOUR_EVERY_DAY,
    });

    expect(minutesForTopic(skipped.sessions, "a")).toBe(240);
  });
});
