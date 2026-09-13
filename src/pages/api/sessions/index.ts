import type { APIRoute } from "astro";

import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { createTopic, insertManualSession, upsertPlan } from "@/lib/repository";
import { manualSessionSchema } from "@/lib/validation";
import { startOfMonth, startOfWeek } from "@/domain/date";

export const prerender = false;

/**
 * Places one block of work on a day, by hand (FR-004, US-008).
 *
 * This is the counterpart to plan generation: the rule proposes a week, this
 * lets the learner state one outright. Either an existing topic is chosen or a
 * new one is named here and created on the spot, so a day can be filled without
 * leaving the calendar.
 *
 * Sessions still hang off a weekly plan row, because that is how the schema
 * groups them, so the week containing the chosen day is created on demand.
 */
export const POST: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) {
    return auth;
  }

  const values = await formValues(context.request);
  const month = values.month ?? "";
  const back = month ? `/calendar?month=${encodeURIComponent(month)}` : "/calendar";

  try {
    const parsed = manualSessionSchema.parse(values);
    const title = parsed.newTopicTitle?.trim() ?? "";
    const chosenTopic = parsed.topicId?.trim() ?? "";

    if (chosenTopic === "" && title === "") {
      return redirectError(context, back, "Wybierz temat albo wpisz nazwę nowego");
    }

    // A topic named here starts with this block as its whole estimate. The
    // learner can refine the estimate, priority and deadline later; requiring
    // them up front would defeat the point of adding work in one gesture.
    const topicId =
      chosenTopic !== ""
        ? chosenTopic
        : (
            await createTopic(auth.db, auth.userId, {
              title,
              estimatedMinutes: parsed.minutes,
              priority: 3,
              deadline: null,
            })
          ).id;

    const planId = await upsertPlan(auth.db, auth.userId, startOfWeek(parsed.date));
    await insertManualSession(auth.db, auth.userId, planId, {
      topicId,
      date: parsed.date,
      minutes: parsed.minutes,
    });

    return redirectWith(context, "/calendar", {
      month: month || startOfMonth(parsed.date),
      ok: "Dodano sesję",
    });
  } catch (cause) {
    return redirectError(context, back, describeFailure(cause).message);
  }
};
