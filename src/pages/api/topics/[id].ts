import type { APIRoute } from "astro";

import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { deleteTopic, updateTopic } from "@/lib/repository";
import { topicUpdateSchema } from "@/lib/validation";

export const prerender = false;

/**
 * Updates or deletes a topic (FR-002).
 *
 * HTML forms can only send GET and POST, so the intended verb arrives in an
 * `_action` field.
 */
export const POST: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) {
    return auth;
  }

  const topicId = context.params.id;
  if (!topicId) {
    return redirectError(context, "/topics", "Brak identyfikatora tematu");
  }

  const values = await formValues(context.request);

  // Topics are edited from the topics page and deleted from the week view's
  // progress list, so the endpoint returns the learner where they acted.
  const week = values.week ?? "";
  const destination = week ? "/dashboard" : "/topics";
  const locationParam: Record<string, string> = week ? { week } : {};
  const back = week ? `/dashboard?week=${encodeURIComponent(week)}` : "/topics";

  try {
    if (values._action === "delete") {
      await deleteTopic(auth.db, topicId);
      return redirectWith(context, destination, { ...locationParam, ok: "Usunięto temat" });
    }

    const { _action, week: _week, ...rest } = values;
    void _action;
    void _week;

    const patch = topicUpdateSchema.parse(rest);
    await updateTopic(auth.db, topicId, patch);
    return redirectWith(context, destination, { ...locationParam, ok: "Zaktualizowano temat" });
  } catch (cause) {
    return redirectError(context, back, describeFailure(cause).message);
  }
};
