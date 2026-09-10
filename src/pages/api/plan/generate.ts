import type { APIRoute } from "astro";

import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { currentWeekStart, regenerateWeek } from "@/lib/planning";
import { generatePlanSchema } from "@/lib/validation";
import { startOfWeek } from "@/domain/date";

export const prerender = false;

/** Builds or rebuilds the plan for a week (FR-004, US-011). */
export const POST: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const { weekStart } = generatePlanSchema.parse(await formValues(context.request));
    const week = weekStart ? startOfWeek(weekStart) : currentWeekStart();

    const plan = await regenerateWeek(auth.db, auth.userId, week);

    const message =
      plan.sessions.length === 0
        ? "No sessions could be scheduled. Check your availability and topics."
        : `Planned ${plan.sessions.length} session${plan.sessions.length === 1 ? "" : "s"}`;

    return redirectWith(context, "/dashboard", { week, ok: message });
  } catch (cause) {
    return redirectError(context, "/dashboard", describeFailure(cause).message);
  }
};
