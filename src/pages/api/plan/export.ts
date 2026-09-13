import type { APIRoute } from "astro";
import { exportCalendar } from "@/domain/calendar-export";
import { isIsoDate, startOfWeek } from "@/domain/date";
import { authenticate } from "@/lib/api";
import { currentWeekStart, loadWeekView } from "@/lib/planning";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const auth = authenticate(context);
  if (auth instanceof Response) return auth;
  const requested = context.url.searchParams.get("week");
  if (requested !== null && !isIsoDate(requested)) {
    return new Response("Niepoprawna data tygodnia", { status: 400 });
  }
  const weekStart = requested ? startOfWeek(requested) : currentWeekStart();
  try {
    const week = await loadWeekView(auth.db, weekStart);
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
    return new Response(
      exportCalendar(
        week.days.flatMap((day) => day.sessions),
        timestamp,
      ),
      {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="plan-${weekStart}.ics"`,
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch {
    return new Response("Nie udało się wyeksportować planu. Spróbuj ponownie.", { status: 503 });
  }
};
