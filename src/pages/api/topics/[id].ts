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
    return redirectError(context, "/topics", "Missing topic id");
  }

  try {
    const values = await formValues(context.request);

    if (values._action === "delete") {
      await deleteTopic(auth.db, topicId);
      return redirectWith(context, "/topics", { ok: "Topic deleted" });
    }

    const { _action, ...rest } = values;
    void _action;

    const patch = topicUpdateSchema.parse(rest);
    await updateTopic(auth.db, topicId, patch);
    return redirectWith(context, "/topics", { ok: "Topic updated" });
  } catch (cause) {
    return redirectError(context, "/topics", describeFailure(cause).message);
  }
};
