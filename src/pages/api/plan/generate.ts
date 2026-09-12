import type { APIRoute } from "astro";

import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { currentWeekStart, regenerateWeek } from "@/lib/planning";
import { generatePlanSchema } from "@/lib/validation";
import { startOfWeek } from "@/domain/date";

export const prerender = false;

/** Polish needs three forms: 1 sesję, 2-4 sesje, 5+ sesji. */
function sessionNoun(count: number): string {
  if (count === 1) return "sesję";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return "sesje";
  return "sesji";
}

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
        ? "Nie udało się zaplanować żadnej sesji. Sprawdź dostępność i tematy."
        : `Zaplanowano ${plan.sessions.length} ${sessionNoun(plan.sessions.length)}`;

    return redirectWith(context, "/dashboard", { week, ok: message });
  } catch (cause) {
    return redirectError(context, "/dashboard", describeFailure(cause).message);
  }
};
