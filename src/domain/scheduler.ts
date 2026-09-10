import { addDays, differenceInDays, weekdayIndex } from "./date";
import type { GeneratePlanInput, GeneratePlanResult, IsoDate, PlannedSession, Priority, Topic } from "./types";

/**
 * The scheduling rule.
 *
 * > The planner allocates each week's declared available minutes to study
 * > topics in descending order of an urgency score derived from priority,
 * > remaining minutes and days remaining until the deadline, and recomputes the
 * > allocation whenever a session is completed or skipped.
 *
 * The function is pure: the same inputs always produce the same plan. Nothing
 * here reads the clock, the database or the environment.
 */

/** Shortest block worth putting in a plan. */
export const DEFAULT_MIN_BLOCK_MINUTES = 15;

/**
 * Horizon used for a topic with no deadline. It is treated as if it were due
 * four weeks out, so that remaining work still creates some pressure without
 * ever outranking a real deadline.
 */
export const NO_DEADLINE_HORIZON_DAYS = 28;

/**
 * Priority acts as a multiplier on the required pace rather than as a separate
 * additive term. That keeps deadline pressure dominant — a topic that must be
 * finished soon outranks a merely important one — while still letting priority
 * break ties between topics under comparable time pressure.
 */
export function priorityFactor(priority: Priority): number {
  return 0.6 + 0.2 * priority;
}

export function remainingMinutes(topic: Topic): number {
  return Math.max(0, topic.estimatedMinutes - topic.completedMinutes);
}

/** A topic is schedulable while it is active and still has work left. */
export function isSchedulable(topic: Topic): boolean {
  return topic.status === "active" && remainingMinutes(topic) > 0;
}

/**
 * Minutes per day the learner would have to spend to finish this topic by its
 * deadline, weighted by priority. Higher means more urgent.
 *
 * A deadline that is today or already past yields the highest pace, because the
 * whole remaining effort is compressed into a single day.
 */
export function urgencyScore(topic: Topic, onDate: IsoDate, remaining: number): number {
  const daysLeft =
    topic.deadline === null ? NO_DEADLINE_HORIZON_DAYS : Math.max(0, differenceInDays(onDate, topic.deadline));

  const requiredPace = remaining / (daysLeft + 1);
  return requiredPace * priorityFactor(topic.priority);
}

interface Candidate {
  topic: Topic;
  block: number;
  score: number;
}

/**
 * Builds a week of dated study sessions.
 *
 * Guarantees, each covered by a test:
 * - no day is scheduled beyond its declared availability;
 * - no topic receives more minutes than it has remaining;
 * - no session is shorter than the minimum block, unless it finishes a topic;
 * - a topic larger than one day's capacity is split across days;
 * - the result is deterministic.
 */
export function generatePlan(input: GeneratePlanInput): GeneratePlanResult {
  const minBlock = input.minBlockMinutes ?? DEFAULT_MIN_BLOCK_MINUTES;

  if (!Number.isFinite(minBlock) || minBlock <= 0) {
    throw new Error("minBlockMinutes must be a positive number");
  }
  if (weekdayIndex(input.weekStart) !== 0) {
    throw new Error(`weekStart must be a Monday, received ${input.weekStart}`);
  }

  const schedulable = input.topics.filter(isSchedulable);
  const remaining = new Map<string, number>(schedulable.map((topic) => [topic.id, remainingMinutes(topic)]));

  const sessions: PlannedSession[] = [];

  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(input.weekStart, offset);
    const declared = input.availability[weekdayIndex(date)] ?? 0;
    let capacity = Math.max(0, Math.floor(declared));

    // Minutes handed to each topic on this day, merged into one session below.
    const allocation = new Map<string, number>();

    while (capacity > 0) {
      const best = pickCandidate(schedulable, remaining, capacity, minBlock, date);
      if (best === null) {
        break;
      }

      allocation.set(best.topic.id, (allocation.get(best.topic.id) ?? 0) + best.block);
      remaining.set(best.topic.id, (remaining.get(best.topic.id) ?? 0) - best.block);
      capacity -= best.block;
    }

    for (const topic of schedulable) {
      const minutes = allocation.get(topic.id);
      if (minutes !== undefined && minutes > 0) {
        sessions.push({ topicId: topic.id, date, minutes });
      }
    }
  }

  let unscheduledMinutes = 0;
  for (const minutes of remaining.values()) {
    unscheduledMinutes += minutes;
  }

  return { weekStart: input.weekStart, sessions, unscheduledMinutes };
}

/**
 * Picks the most urgent topic that can take a block right now.
 *
 * Allocation happens one `minBlock` unit at a time. Because urgency falls as a
 * topic's remaining work shrinks, topics under comparable pressure interleave
 * across a long day instead of one of them consuming all of it.
 */
function pickCandidate(
  topics: readonly Topic[],
  remaining: ReadonlyMap<string, number>,
  capacity: number,
  minBlock: number,
  date: IsoDate,
): Candidate | null {
  let best: Candidate | null = null;

  for (const topic of topics) {
    const left = remaining.get(topic.id) ?? 0;
    if (left <= 0) {
      continue;
    }

    const block = Math.min(capacity, left, minBlock);

    // Short blocks are only acceptable when they finish the topic off.
    const finishesTopic = block === left;
    if (block < minBlock && !finishesTopic) {
      continue;
    }
    if (block <= 0) {
      continue;
    }

    const score = urgencyScore(topic, date, left);

    if (best === null || score > best.score || (score === best.score && topic.id < best.topic.id)) {
      best = { topic, block, score };
    }
  }

  return best;
}
