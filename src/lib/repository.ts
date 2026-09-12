import type { createClient } from "@/lib/supabase";
import type { Database } from "@/lib/database.types";
import type { Availability, IsoDate, Priority, SessionStatus, Topic, TopicStatus } from "@/domain/types";

/**
 * Data access for the planner.
 *
 * Row level security already restricts every query to the calling learner, so
 * these functions do not filter by user id defensively; they pass it only where
 * a value has to be written.
 */

export type Db = NonNullable<ReturnType<typeof createClient>>;

export type TopicRow = Database["public"]["Tables"]["topics"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

export function toTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    title: row.title,
    estimatedMinutes: row.estimated_minutes,
    completedMinutes: row.completed_minutes,
    priority: row.priority as Priority,
    deadline: row.deadline,
    status: row.status as TopicStatus,
  };
}

/** Raised when a query fails, so endpoints can answer with one shape. */
export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}

function unwrap<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) {
    throw new RepositoryError(`${what}: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new RepositoryError(`${what}: no data returned`);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Topics
// ---------------------------------------------------------------------------

export async function listTopics(db: Db): Promise<TopicRow[]> {
  return unwrap(
    await db.from("topics").select("*").order("created_at", { ascending: true }),
    "Nie udało się wczytać tematów",
  );
}

export async function createTopic(
  db: Db,
  userId: string,
  input: { title: string; estimatedMinutes: number; priority: number; deadline: string | null },
): Promise<TopicRow> {
  return unwrap(
    await db
      .from("topics")
      .insert({
        user_id: userId,
        title: input.title,
        estimated_minutes: input.estimatedMinutes,
        priority: input.priority,
        deadline: input.deadline,
      })
      .select("*")
      .single(),
    "Nie udało się dodać tematu",
  );
}

export async function updateTopic(
  db: Db,
  topicId: string,
  patch: Partial<{
    title: string;
    estimatedMinutes: number;
    priority: number;
    deadline: string | null;
    status: TopicStatus;
  }>,
): Promise<TopicRow> {
  const payload: Database["public"]["Tables"]["topics"]["Update"] = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.estimatedMinutes !== undefined) payload.estimated_minutes = patch.estimatedMinutes;
  if (patch.priority !== undefined) payload.priority = patch.priority;
  if (patch.deadline !== undefined) payload.deadline = patch.deadline;
  if (patch.status !== undefined) payload.status = patch.status;

  if (Object.keys(payload).length === 0) {
    throw new RepositoryError("Nie ma czego zaktualizować", 400);
  }

  const { data, error } = await db.from("topics").update(payload).eq("id", topicId).select("*").maybeSingle();

  if (error) {
    throw new RepositoryError(`Could not update the topic: ${error.message}`);
  }
  if (data === null) {
    // Either the topic does not exist, or row level security hides it.
    throw new RepositoryError("Nie znaleziono tematu", 404);
  }
  return data;
}

export async function deleteTopic(db: Db, topicId: string): Promise<void> {
  const { error } = await db.from("topics").delete().eq("id", topicId);
  if (error) {
    throw new RepositoryError(`Could not delete the topic: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

/** Always returns seven values; a weekday with no row means zero minutes. */
export async function getAvailability(db: Db): Promise<Availability> {
  const rows = unwrap(await db.from("availability").select("weekday, minutes"), "Nie udało się wczytać dostępności");

  const minutes: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const row of rows) {
    if (row.weekday >= 0 && row.weekday <= 6) {
      minutes[row.weekday] = row.minutes;
    }
  }
  return minutes as unknown as Availability;
}

export async function setAvailability(db: Db, userId: string, minutes: readonly number[]): Promise<void> {
  const rows = minutes.map((value, weekday) => ({ user_id: userId, weekday, minutes: value }));
  const { error } = await db.from("availability").upsert(rows, { onConflict: "user_id,weekday" });
  if (error) {
    throw new RepositoryError(`Could not save availability: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Plans and sessions
// ---------------------------------------------------------------------------

export async function upsertPlan(db: Db, userId: string, weekStart: IsoDate): Promise<string> {
  const plan = unwrap<{ id: string }>(
    await db
      .from("plans")
      .upsert(
        { user_id: userId, week_start: weekStart, generated_at: new Date().toISOString() },
        { onConflict: "user_id,week_start" },
      )
      .select("id")
      .single(),
    "Nie udało się utworzyć planu",
  );

  return plan.id;
}

export async function listSessionsInRange(db: Db, from: IsoDate, to: IsoDate): Promise<SessionRow[]> {
  return unwrap(
    await db
      .from("sessions")
      .select("*")
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .order("scheduled_date", { ascending: true }),
    "Nie udało się wczytać sesji",
  );
}

/** Removes only the untouched sessions, so completed history survives a regeneration. */
export async function deletePlannedSessionsInRange(db: Db, from: IsoDate, to: IsoDate): Promise<void> {
  const { error } = await db
    .from("sessions")
    .delete()
    .eq("status", "planned")
    .gte("scheduled_date", from)
    .lte("scheduled_date", to);

  if (error) {
    throw new RepositoryError(`Could not clear the previous plan: ${error.message}`);
  }
}

export async function insertSessions(
  db: Db,
  userId: string,
  planId: string,
  sessions: readonly { topicId: string; date: IsoDate; minutes: number }[],
): Promise<void> {
  if (sessions.length === 0) {
    return;
  }

  const { error } = await db.from("sessions").insert(
    sessions.map((session) => ({
      user_id: userId,
      plan_id: planId,
      topic_id: session.topicId,
      scheduled_date: session.date,
      minutes: session.minutes,
    })),
  );

  if (error) {
    throw new RepositoryError(`Could not save the plan: ${error.message}`);
  }
}

/**
 * Moves a session between statuses and adjusts the parent topic's progress in
 * the same database call. See the `set_session_status` migration.
 */
export async function setSessionStatus(db: Db, sessionId: string, status: SessionStatus): Promise<SessionRow> {
  const { data, error } = await db.rpc("set_session_status", {
    p_session_id: sessionId,
    p_status: status,
  });

  if (error) {
    const notFound = error.message.includes("session not found");
    throw new RepositoryError(
      notFound ? "Nie znaleziono sesji" : `Could not update the session: ${error.message}`,
      notFound ? 404 : 500,
    );
  }

  return data;
}
