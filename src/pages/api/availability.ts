import type { APIRoute } from "astro";

import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { setAvailability } from "@/lib/repository";
import { availabilitySchema } from "@/lib/validation";

export const prerender = false;

/** Stores minutes available on each weekday (FR-003). */
export const POST: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) {
    return auth;
  }

  try {
    const values = await formValues(context.request);
    const minutes = Array.from({ length: 7 }, (_, weekday) => values[`day-${weekday}`] ?? "0");

    const parsed = availabilitySchema.parse({ minutes });
    await setAvailability(auth.db, auth.userId, parsed.minutes);

    return redirectWith(context, "/topics", { ok: "Zapisano dostępność" });
  } catch (cause) {
    return redirectError(context, "/topics", describeFailure(cause).message);
  }
};
