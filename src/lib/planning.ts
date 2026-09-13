import { addDays, endOfMonth, startOfMonth, startOfWeek, weekdayIndex } from "@/domain/date";
import { generatePlan, remainingCapacity, remainingMinutes, reserveTopicMinutes } from "@/domain/scheduler";
import type { Availability, IsoDate, SessionStatus, Topic } from "@/domain/types";
import {
  deletePlannedSessionsInRange,
  getAvailability,
  insertSessions,
  listSessionsInRange,
  listTopics,
  toTopic,
  upsertPlan,
  type Db,
  type SessionRow,
} from "@/lib/repository";

/**
 * Everything that turns stored state into a week of study sessions.
 *
 * The scheduling decision itself lives in `src/domain/scheduler.ts` and is
 * tested there. This module only supplies it with data and persists the result.
 */

/** Today, from the server clock, as a calendar date. */
export function todayIso(now: Date = new Date()): IsoDate {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function currentWeekStart(now: Date = new Date()): IsoDate {
  return startOfWeek(todayIso(now));
}

export interface SessionView {
  id: string;
  topicId: string;
  topicTitle: string;
  date: IsoDate;
  minutes: number;
  status: SessionStatus;
  /** Placed by the learner rather than by the scheduling rule. */
  manual: boolean;
}

export interface TopicProgress {
  topic: Topic;
  remainingMinutes: number;
  percentComplete: number;
}

export interface WeekView {
  weekStart: IsoDate;
  weekEnd: IsoDate;
  days: { date: IsoDate; sessions: SessionView[]; totalMinutes: number; availableMinutes: number }[];
  topics: TopicProgress[];
  availability: Availability;
  plannedMinutes: number;
  completedMinutes: number;
  hasPlan: boolean;
}

/**
 * Rebuilds a week from current state.
 *
 * Sessions the learner already acted on — done or skipped — are kept as
 * history, and the capacity they occupy is removed from the day before
 * replanning, so a regeneration never double-books an evening that has already
 * been spent.
 */
export async function regenerateWeek(db: Db, userId: string, weekStart: IsoDate) {
  const weekEnd = addDays(weekStart, 6);

  const [topicRows, availability, existing] = await Promise.all([
    listTopics(db),
    getAvailability(db),
    listSessionsInRange(db, weekStart, weekEnd),
  ]);

  // A block the learner placed by hand counts as settled even while it is still
  // "planned": it survives regeneration, so the evening it occupies is no longer
  // free to allocate.
  const settled = existing.filter((session) => session.status !== "planned" || session.manual);

  // Days that already passed cannot be planned into, and evenings already spent
  // on a settled session no longer have that capacity to give.
  const adjusted: number[] = [...remainingCapacity(availability, weekStart, todayIso())];
  for (const session of settled) {
    const index = weekdayIndex(session.scheduled_date);
    adjusted[index] = Math.max(0, adjusted[index] - session.minutes);
  }

  await deletePlannedSessionsInRange(db, weekStart, weekEnd);

  const plan = generatePlan({
    weekStart,
    topics: reserveTopicMinutes(
      topicRows.map(toTopic),
      existing
        .filter((session) => session.manual && session.status === "planned")
        .map((session) => ({ topicId: session.topic_id, minutes: session.minutes })),
    ),
    availability: adjusted as unknown as Availability,
  });

  const planId = await upsertPlan(db, userId, weekStart);
  await insertSessions(db, userId, planId, plan.sessions);

  return plan;
}

/** Assembles everything the dashboard renders for one week. */
export async function loadWeekView(db: Db, weekStart: IsoDate): Promise<WeekView> {
  const weekEnd = addDays(weekStart, 6);

  const [topicRows, availability, sessionRows] = await Promise.all([
    listTopics(db),
    getAvailability(db),
    listSessionsInRange(db, weekStart, weekEnd),
  ]);

  const topics = topicRows.map(toTopic);
  const titleById = new Map(topics.map((topic) => [topic.id, topic.title]));

  const views: SessionView[] = sessionRows.map((row: SessionRow) => ({
    id: row.id,
    topicId: row.topic_id,
    topicTitle: titleById.get(row.topic_id) ?? "Usunięty temat",
    date: row.scheduled_date,
    minutes: row.minutes,
    status: row.status,
    manual: row.manual,
  }));

  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = addDays(weekStart, offset);
    const sessions = views
      .filter((session) => session.date === date)
      .sort((a, b) => a.topicTitle.localeCompare(b.topicTitle));

    return {
      date,
      sessions,
      totalMinutes: sessions.reduce((sum, session) => sum + session.minutes, 0),
      availableMinutes: availability[weekdayIndex(date)] ?? 0,
    };
  });

  const progress: TopicProgress[] = topics
    .filter((topic) => topic.status !== "archived")
    .map((topic) => ({
      topic,
      remainingMinutes: remainingMinutes(topic),
      percentComplete:
        topic.estimatedMinutes === 0
          ? 0
          : Math.min(100, Math.round((topic.completedMinutes / topic.estimatedMinutes) * 100)),
    }));

  return {
    weekStart,
    weekEnd,
    days,
    topics: progress,
    availability,
    plannedMinutes: views
      .filter((session) => session.status === "planned")
      .reduce((sum, session) => sum + session.minutes, 0),
    completedMinutes: views
      .filter((session) => session.status === "done")
      .reduce((sum, session) => sum + session.minutes, 0),
    hasPlan: views.length > 0,
  };
}

export interface MonthDay {
  date: IsoDate;
  inMonth: boolean;
  isToday: boolean;
  sessions: SessionView[];
  plannedMinutes: number;
  completedMinutes: number;
  availableMinutes: number;
}

export interface MonthView {
  monthStart: IsoDate;
  monthEnd: IsoDate;
  weeks: MonthDay[][];
  /** Active topics, for the day panel to offer when placing a block. */
  topics: Topic[];
  plannedMinutes: number;
  completedMinutes: number;
  availableMinutes: number;
  sessionCount: number;
}

/**
 * A whole month laid out as calendar weeks.
 *
 * The grid always starts on a Monday and ends on a Sunday, so it usually spills
 * into the neighbouring months; those days are marked `inMonth: false` and are
 * rendered muted rather than dropped, because a week that is half-visible reads
 * as a rendering fault.
 *
 * This is a read-only view. Generating a plan stays a per-week action — the
 * scheduling rule allocates against one week's declared availability, and
 * nothing here changes that.
 */
export async function loadMonthView(db: Db, anyDayInMonth: IsoDate, today: IsoDate = todayIso()): Promise<MonthView> {
  const monthStart = startOfMonth(anyDayInMonth);
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = addDays(startOfWeek(monthEnd), 6);

  const [topicRows, availability, sessionRows] = await Promise.all([
    listTopics(db),
    getAvailability(db),
    listSessionsInRange(db, gridStart, gridEnd),
  ]);

  const topics = topicRows.map(toTopic);
  const titleById = new Map(topics.map((topic) => [topic.id, topic.title]));

  const views: SessionView[] = sessionRows.map((row: SessionRow) => ({
    id: row.id,
    topicId: row.topic_id,
    topicTitle: titleById.get(row.topic_id) ?? "Usunięty temat",
    date: row.scheduled_date,
    minutes: row.minutes,
    status: row.status,
    manual: row.manual,
  }));

  const dayCount = (Date.parse(`${gridEnd}T00:00:00.000Z`) - Date.parse(`${gridStart}T00:00:00.000Z`)) / 86_400_000 + 1;

  const days: MonthDay[] = Array.from({ length: dayCount }, (_, offset) => {
    const date = addDays(gridStart, offset);
    const sessions = views
      .filter((session) => session.date === date)
      .sort((a, b) => a.topicTitle.localeCompare(b.topicTitle, "pl"));

    return {
      date,
      inMonth: date >= monthStart && date <= monthEnd,
      isToday: date === today,
      sessions,
      plannedMinutes: sessions
        .filter((session) => session.status === "planned")
        .reduce((sum, session) => sum + session.minutes, 0),
      completedMinutes: sessions
        .filter((session) => session.status === "done")
        .reduce((sum, session) => sum + session.minutes, 0),
      availableMinutes: availability[weekdayIndex(date)] ?? 0,
    };
  });

  const weeks: MonthDay[][] = [];
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  const inMonth = days.filter((day) => day.inMonth);

  return {
    monthStart,
    monthEnd,
    weeks,
    topics: topics.filter((topic) => topic.status !== "archived"),
    plannedMinutes: inMonth.reduce((sum, day) => sum + day.plannedMinutes, 0),
    completedMinutes: inMonth.reduce((sum, day) => sum + day.completedMinutes, 0),
    availableMinutes: inMonth.reduce((sum, day) => sum + day.availableMinutes, 0),
    sessionCount: inMonth.reduce((sum, day) => sum + day.sessions.length, 0),
  };
}
