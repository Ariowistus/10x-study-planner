import type { APIContext } from "astro";
import type { ZodError } from "zod";

import { createClient } from "@/lib/supabase";
import { RepositoryError, type Db } from "@/lib/repository";
import { formatIssues } from "@/lib/validation";

/**
 * Shared plumbing for the API routes.
 *
 * The routes are driven by ordinary HTML forms, so the success path is a
 * redirect back to the page the learner came from and failures are reported
 * through a query parameter rather than a JSON body.
 */

export interface AuthedRequest {
  db: Db;
  userId: string;
}

/**
 * Resolves the caller, or returns the response to send instead.
 * Route protection already happens in middleware; this guards the API surface,
 * which the middleware does not cover.
 */
export function authenticate(context: APIContext): AuthedRequest | Response {
  const user = context.locals.user;
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = createClient(context.request.headers, context.cookies);
  if (!db) {
    return new Response("Supabase is not configured", { status: 503 });
  }

  return { db, userId: user.id };
}

export function redirectWith(context: APIContext, path: string, params: Record<string, string>): Response {
  const url = new URL(path, context.url.origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return context.redirect(`${url.pathname}${url.search}`);
}

export function redirectError(context: APIContext, path: string, message: string): Response {
  return redirectWith(context, path, { error: message });
}

/** Maps whatever went wrong onto a single message the pages can display. */
export function describeFailure(cause: unknown): { message: string; status: number } {
  if (cause instanceof RepositoryError) {
    return { message: cause.message, status: cause.status };
  }
  if (isZodError(cause)) {
    return { message: formatIssues(cause).join("; "), status: 400 };
  }
  if (cause instanceof Error) {
    return { message: cause.message, status: 500 };
  }
  return { message: "Unexpected error", status: 500 };
}

function isZodError(cause: unknown): cause is ZodError {
  return typeof cause === "object" && cause !== null && "issues" in cause && Array.isArray((cause as ZodError).issues);
}

/**
 * Reads a form body into a plain object, which is what the Zod schemas expect.
 * Absent fields are genuinely absent, so callers have to handle `undefined`.
 */
export async function formValues(request: Request): Promise<Partial<Record<string, string>>> {
  const form = await request.formData();
  const values: Partial<Record<string, string>> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") {
      values[key] = value;
    }
  }
  return values;
}
