/**
 * Domain types for the study planner.
 *
 * These types are deliberately free of any database or framework concern so
 * that the scheduling rule can be exercised in isolation.
 */

/** Priority declared by the learner. 5 is the most important. */
export type Priority = 1 | 2 | 3 | 4 | 5;

/** A calendar date in `YYYY-MM-DD` form. */
export type IsoDate = string;

/** Weekday index where 0 is Monday and 6 is Sunday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type TopicStatus = "active" | "done" | "archived";

export type SessionStatus = "planned" | "done" | "skipped";

/** Something the learner has to cover before the exam. */
export interface Topic {
  id: string;
  title: string;
  /** Total effort the learner estimated for this topic. */
  estimatedMinutes: number;
  /** Effort already completed through finished sessions. */
  completedMinutes: number;
  priority: Priority;
  /** Optional hard date by which the topic should be finished. */
  deadline: IsoDate | null;
  status: TopicStatus;
}

/**
 * Minutes the learner can realistically study on each weekday.
 * Index 0 is Monday. Zero is a valid value and means "do not schedule".
 */
export type Availability = readonly [number, number, number, number, number, number, number];

/** A block of work on one topic, on one day. */
export interface PlannedSession {
  topicId: string;
  date: IsoDate;
  minutes: number;
}

export interface GeneratePlanInput {
  /** Monday of the week being planned. */
  weekStart: IsoDate;
  topics: readonly Topic[];
  availability: Availability;
  /**
   * Shortest block worth scheduling. Capacity left below this threshold is
   * left unused rather than turned into scheduling noise.
   */
  minBlockMinutes?: number;
}

export interface GeneratePlanResult {
  weekStart: IsoDate;
  sessions: PlannedSession[];
  /** Minutes that could not be placed because the week ran out of capacity. */
  unscheduledMinutes: number;
}
