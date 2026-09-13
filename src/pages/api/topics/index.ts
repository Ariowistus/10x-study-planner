import type { APIRoute } from "astro";

import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { createTopic, listTopics } from "@/lib/repository";
import { topicInputSchema } from "@/lib/validation";

export const prerender = false;

/** The authenticated resource's read operation, scoped by RLS like its writes. */
export const GET: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) return auth;
  try {
    return Response.json(await listTopics(auth.db), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return new Response("Nie udało się wczytać tematów", { status: 503 });
  }
};

/** Creates a topic (FR-002). */
export const POST: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const input = topicInputSchema.parse(await formValues(context.request));
    await createTopic(auth.db, auth.userId, input);
    return redirectWith(context, "/topics", { ok: "Dodano temat" });
  } catch (cause) {
    return redirectError(context, "/topics", describeFailure(cause).message);
  }
};
