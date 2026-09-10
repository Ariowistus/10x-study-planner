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
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), "Not a valid calendar date");

export const topicInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  estimatedMinutes: z.coerce
    .number()
    .int("Estimate must be a whole number of minutes")
    .min(1, "Estimate must be at least one minute")
    .max(100_000, "Estimate is unrealistically large"),
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
    .array(z.coerce.number().int().min(0, "Minutes cannot be negative").max(1440, "A day has 1440 minutes"))
    .length(7, "Availability must cover all seven weekdays"),
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
