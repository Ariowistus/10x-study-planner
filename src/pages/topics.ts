import type { APIRoute } from "astro";
export const prerender = false;
/** Preserve existing bookmarks while keeping only two workspace views. */
export const GET: APIRoute = (context) => context.redirect(`/calendar${context.url.search}`, 302);
