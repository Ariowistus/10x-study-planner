import type { APIRoute } from "astro";

import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { setSessionStatus } from "@/lib/repository";
import { sessionStatusSchema } from "@/lib/validation";

export const prerender = false;

/** How each stored status reads back to the learner. */
const SESSION_STATUS_PL: Record<"planned" | "done" | "skipped", string> = {
  planned: "zaplanowaną",
  done: "zrobioną",
  skipped: "pominiętą",
};

/**
 * Marks a session done, skipped, or back to planned (FR-005).
 *
 * The progress bookkeeping happens inside `set_session_status` in the database,
 * so the session and its topic can never disagree.
 */
export const POST: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) {
    return auth;
  }

  const sessionId = context.params.id;
  const values = await formValues(context.request);
  const week = values.week ?? "";
  const back = week ? `/dashboard?week=${encodeURIComponent(week)}` : "/dashboard";

  if (!sessionId) {
    return redirectError(context, back, "Brak identyfikatora sesji");
  }

  try {
    const { status } = sessionStatusSchema.parse(values);
    await setSessionStatus(auth.db, sessionId, status);

    const params: Record<string, string> = { ok: `Oznaczono sesję jako ${SESSION_STATUS_PL[status]}` };
    if (week) {
      params.week = week;
    }
    return redirectWith(context, "/dashboard", params);
  } catch (cause) {
    return redirectError(context, back, describeFailure(cause).message);
  }
};
