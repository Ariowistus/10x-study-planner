import type { APIRoute } from "astro";

import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { createTopic, insertManualSession, listTopics, toTopic, upsertPlan } from "@/lib/repository";
import { manualSessionSchema } from "@/lib/validation";
import { startOfMonth, startOfWeek } from "@/domain/date";

export const prerender = false;

/**
 * Places one block of work on a day, by hand (FR-004, US-008).
 *
 * This is the counterpart to plan generation: the rule proposes a week, this
 * lets the learner state one outright. The topic is simply typed. A name that
 * matches one the learner already has reuses it — otherwise typing "Angielski"
 * on Monday and again on Tuesday would create two unrelated topics and split
 * the progress between them.
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

    if (title === "") {
      return redirectError(context, back, "Wpisz nazwę tematu");
    }

    const existing = (await listTopics(auth.db))
      .map(toTopic)
      .find((topic) => topic.title.trim().toLocaleLowerCase("pl") === title.toLocaleLowerCase("pl"));

    // A topic named here for the first time starts with this block as its whole
    // estimate. The learner can refine the estimate, priority and deadline
    // later; demanding them up front would defeat adding work in one gesture.
    const topicId =
      existing?.id ??
      (
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
