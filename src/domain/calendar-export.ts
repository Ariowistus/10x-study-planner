import { addDays } from "./date";
import { timeInMinutes } from "./agenda";
import type { IsoDate, SessionStatus } from "./types";

interface CalendarSession {
  id: string;
  topicTitle: string;
  date: IsoDate;
  minutes: number;
  status: SessionStatus;
  startTime?: string | null;
}

function escapeText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** RFC 5545 §3.1: fold at 75 UTF-8 octets, never inside a code point. */
function foldLine(line: string): string {
  const encoder = new TextEncoder();
  let result = "";
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > 75) {
      result += "\r\n ";
      size = 1;
    }
    result += char;
    size += bytes;
  }
  return result;
}

/** Floating local times preserve the learner's wall clock; old entries stay all-day. */
export function exportCalendar(sessions: readonly CalendarSession[], timestamp: string): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//10x Study Planner//Study Plan//PL", "CALSCALE:GREGORIAN"];
  for (const session of sessions.filter((entry) => entry.status === "planned")) {
    const end = session.startTime ? timeInMinutes(session.startTime) + session.minutes : 0;
    const endDate = end === 1440 ? addDays(session.date, 1) : session.date;
    const endTime = `${String(Math.floor((end % 1440) / 60)).padStart(2, "0")}${String(end % 60).padStart(2, "0")}00`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${session.id}@10x-study-planner`,
      `DTSTAMP:${timestamp}`,
      ...(session.startTime
        ? [
            `DTSTART:${session.date.replaceAll("-", "")}T${session.startTime.slice(0, 5).replace(":", "")}00`,
            `DTEND:${endDate.replaceAll("-", "")}T${endTime}`,
          ]
        : [
            `DTSTART;VALUE=DATE:${session.date.replaceAll("-", "")}`,
            `DTEND;VALUE=DATE:${addDays(session.date, 1).replaceAll("-", "")}`,
          ]),
      `SUMMARY:${escapeText(`${session.topicTitle} (${session.minutes} min)`)}`,
      `DESCRIPTION:${escapeText(`Nauka: ${session.minutes} min. ${session.startTime ? "Godzina lokalna kalendarza." : "Bez ustalonej godziny."}`)}`,
      session.startTime ? "TRANSP:OPAQUE" : "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }
  return [...lines, "END:VCALENDAR"].map(foldLine).join("\r\n") + "\r\n";
}
