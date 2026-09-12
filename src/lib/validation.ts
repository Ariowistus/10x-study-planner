import { z } from "zod";

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
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "To nie jest poprawna data kalendarzowa");

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

export const generatePlanSchema = z.object({
  weekStart: isoDate.optional(),
});

export const sessionStatusSchema = z.object({
  status: z.enum(["planned", "done", "skipped"]),
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
