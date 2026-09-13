import { z } from "zod";
import { isIsoDate } from "../domain/date";
import { endsWithinDay } from "../domain/agenda";

/**
 * Request validation for the API surface.
 *
 * Every endpoint parses its input here before touching the database. The
 * database has matching constraints, so these schemas are the first line of
 * defence rather than the only one.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Oczekiwano daty w formacie RRRR-MM-DD")
  .refine(isIsoDate, "To nie jest poprawna data kalendarzowa");

export const topicInputSchema = z.object({
  title: z.string().trim().min(1, "Tytuł jest wymagany").max(200, "Tytuł jest za długi"),
  estimatedMinutes: z.coerce
    .number()
    .int("Szacowany czas musi być pełną liczbą minut")
    .min(1, "Szacowany czas to co najmniej jedna minuta")
    .max(100_000, "Szacowany czas jest nierealistycznie duży"),
  priority: z.coerce.number().int().min(1).max(5),
  deadline: z
    .union([isoDate, z.literal("")])
    .optional()
    .transform((value) => (value === "" || value === undefined ? null : value)),
});

export const topicUpdateSchema = topicInputSchema.partial().extend({
  status: z.enum(["active", "done", "archived"]).optional(),
});

export const availabilitySchema = z.object({
  minutes: z
    .array(z.coerce.number().int().min(0, "Minuty nie mogą być ujemne").max(1440, "Doba ma 1440 minut"))
    .length(7, "Dostępność musi obejmować wszystkie siedem dni tygodnia"),
});

/** One weekday at a time, as posted from a day card on the plan. */
export const availabilityDaySchema = z.object({
  weekday: z.coerce.number().int().min(0, "Nieznany dzień tygodnia").max(6, "Nieznany dzień tygodnia"),
  minutes: z.coerce
    .number()
    .int("Minuty muszą być pełną liczbą")
    .min(0, "Minuty nie mogą być ujemne")
    .max(1440, "Doba ma 1440 minut"),
});

export const generatePlanSchema = z.object({
  weekStart: isoDate.optional(),
});

/**
 * A block the learner places by hand. Either an existing topic is chosen, or a
 * new one is named and created on the spot; the endpoint enforces that exactly
 * one of the two arrives.
 */
export const manualSessionSchema = z.object({
  date: isoDate,
  minutes: z.coerce
    .number()
    .int("Minuty muszą być pełną liczbą")
    .min(1, "Sesja musi trwać co najmniej minutę")
    .max(1440, "Doba ma 1440 minut"),
  topicId: z.string().trim().optional(),
  newTopicTitle: z.string().trim().max(200, "Tytuł jest za długi").optional(),
});

export const sessionStatusSchema = z.object({
  status: z.enum(["planned", "done", "skipped"]),
});

export const calendarEntrySchema = z
  .object({
    newTopicTitle: z.string().trim().min(1, "Wpisz nazwę zajęcia").max(200, "Nazwa jest za długa"),
    date: isoDate,
    startTime: z
      .union([z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Podaj godzinę GG:MM"), z.literal("")])
      .optional()
      .transform((value) => (value === "" || value === undefined ? null : value)),
    minutes: z.coerce.number().int().min(1, "Zajęcie musi trwać co najmniej minutę").max(1440, "Doba ma 1440 minut"),
  })
  .refine((value) => !value.startTime || endsWithinDay(value.startTime, value.minutes), {
    message: "Zajęcie musi zakończyć się do północy",
    path: ["startTime"],
  });

export type TopicInput = z.infer<typeof topicInputSchema>;
export type TopicUpdate = z.infer<typeof topicUpdateSchema>;

/** Turns a Zod failure into a flat, user-presentable message list. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");
    return path ? `${path}: ${issue.message}` : issue.message;
  });
}
