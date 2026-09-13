import type { APIRoute } from "astro";
import { authenticate, describeFailure, formValues, redirectError, redirectWith } from "@/lib/api";
import { saveCalendarSession } from "@/lib/repository";
import { calendarEntrySchema } from "@/lib/validation";
import { isIsoDate, startOfMonth } from "@/domain/date";

export const prerender = false;
export const POST: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) return auth;
  const values = await formValues(context.request);
  const back =
    values.date && isIsoDate(values.date)
      ? "/calendar?month=" + startOfMonth(values.date) + "&day=" + values.date
      : "/calendar";
  try {
    const parsed = calendarEntrySchema.parse(values);
    await saveCalendarSession(auth.db, { ...parsed, title: parsed.newTopicTitle });
    return redirectWith(context, "/calendar", {
      month: startOfMonth(parsed.date),
      day: parsed.date,
      ok: "Dodano zajęcie",
    });
  } catch (cause) {
    return redirectError(context, back, describeFailure(cause).message);
  }
};
