import type { APIRoute } from "astro";

import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { getAvailability, setAvailability } from "@/lib/repository";
import { availabilityDaySchema, availabilitySchema } from "@/lib/validation";

export const prerender = false;

/**
 * Stores minutes available on each weekday (FR-003).
 *
 * Two shapes post here. The topics page sends all seven days at once. A day
 * card on the plan sends a single `weekday` plus its `minutes`, so the learner
 * can fix an evening without leaving the week they are looking at; that path
 * reads the stored week first and replaces one entry, because availability is
 * stored as a whole row.
 */
export const POST: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) {
    return auth;
  }

  const values = await formValues(context.request);

  if (values.weekday !== undefined) {
    const week = values.week ?? "";
    try {
      const parsed = availabilityDaySchema.parse(values);
      const current = await getAvailability(auth.db);
      const next = current.map((value, index) => (index === parsed.weekday ? parsed.minutes : value));

      await setAvailability(auth.db, auth.userId, next);

      const params: Record<string, string> = { ok: "Zapisano minuty na ten dzień" };
      if (week) {
        params.week = week;
      }
      return redirectWith(context, "/dashboard", params);
    } catch (cause) {
      const back = week ? `/dashboard?week=${encodeURIComponent(week)}` : "/dashboard";
      return redirectError(context, back, describeFailure(cause).message);
    }
  }

  try {
    const minutes = Array.from({ length: 7 }, (_, weekday) => values[`day-${weekday}`] ?? "0");

    const parsed = availabilitySchema.parse({ minutes });
    await setAvailability(auth.db, auth.userId, parsed.minutes);

    return redirectWith(context, "/topics", { ok: "Zapisano dostępność" });
  } catch (cause) {
    return redirectError(context, "/topics", describeFailure(cause).message);
  }
};
