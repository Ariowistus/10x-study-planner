import { describe, expect, it } from "vitest";
import { generatePlan, reserveTopicMinutes } from "./scheduler";
import type { Topic } from "./types";

const topic: Topic = {
  id: "one",
  title: "Sieci",
  estimatedMinutes: 120,
  completedMinutes: 30,
  priority: 3,
  deadline: null,
  status: "active",
};

describe("reserving manual study time", () => {
  it("never schedules manual planned minutes a second time or changes saved progress", () => {
    const topics = reserveTopicMinutes([topic], [{ topicId: "one", minutes: 60 }]);
    const plan = generatePlan({ weekStart: "2026-09-14", topics, availability: [60, 60, 0, 0, 0, 0, 0] });
    expect(plan.sessions.reduce((total, session) => total + session.minutes, 0)).toBe(30);
    expect(topic.completedMinutes).toBe(30);
  });
  it("handles multiple manual blocks, other topics, and overbooking", () => {
    const topics = reserveTopicMinutes(
      [topic],
      [
        { topicId: "other", minutes: 900 },
        { topicId: "one", minutes: 60 },
        { topicId: "one", minutes: 60 },
      ],
    );
    const plan = generatePlan({ weekStart: "2026-09-14", topics, availability: [120, 120, 0, 0, 0, 0, 0] });
    expect(plan.sessions).toEqual([]);
    expect(reserveTopicMinutes([topic], [])[0]).toEqual(topic);
  });
});
