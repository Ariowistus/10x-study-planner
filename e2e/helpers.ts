import { expect, type Locator, type Page } from "@playwright/test";

export const PASSWORD = "planner-e2e-password";

let counter = 0;

export function toIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Monday of the week after this one.
 *
 * The planner refuses to schedule days that have already passed, so a test that
 * planned the current week would see a different number of usable days
 * depending on when it ran. Planning next week keeps all seven days available
 * whatever day the suite runs on.
 */
export function nextWeekMonday(from: Date = new Date()): string {
  const mondayIndex = (from.getDay() + 6) % 7; // 0 is Monday
  const monday = new Date(from);
  monday.setDate(monday.getDate() + (7 - mondayIndex));
  return toIso(monday);
}

export function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIso(date);
}

/** A fresh address per test, so runs never collide on an existing account. */
export function uniqueEmail(): string {
  counter += 1;
  return `learner-${Date.now().toString(36)}-${counter}@example.com`;
}

/**
 * Waits until every Astro island on the page has hydrated.
 *
 * Astro marks a server-rendered island with an `ssr` attribute and removes it
 * once React takes over. Typing before that happens looks like it worked, and
 * then React mounts with its initial empty state and silently discards what was
 * typed — which presents itself as "the form says the field is required" rather
 * than as a timing problem.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => document.querySelectorAll("astro-island[ssr]").length === 0, undefined, {
    timeout: 15_000,
  });
}

/**
 * Fills a React-controlled input and confirms the value survived.
 *
 * Retried, because hydration can land between the fill and the assertion.
 */
export async function fillControlled(locator: Locator, value: string): Promise<void> {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value, { timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

/**
 * Waits for the browser to leave a page, and reports the on-screen error if it
 * does not.
 *
 * Both auth endpoints report failure by redirecting back to the same path with
 * an `error` parameter, so a naive wait on "the path changed" hangs for the
 * full timeout and then says nothing useful about the cause.
 */
async function expectToLeave(page: Page, pathname: string, action: string): Promise<void> {
  try {
    await page.waitForURL((url) => url.pathname !== pathname, { timeout: 20_000 });
  } catch {
    const shown = await page.locator("body").innerText();
    throw new Error(`${action} did not navigate away from ${pathname}. Page said:\n${shown.slice(0, 600)}`);
  }

  const error = new URL(page.url()).searchParams.get("error");
  if (error !== null) {
    throw new Error(`${action} failed: ${error}`);
  }
}

/** Registers an account and leaves the browser signed in. */
export async function registerAndSignIn(page: Page): Promise<string> {
  const email = uniqueEmail();

  await page.goto("/auth/signup");
  await waitForHydration(page);
  await fillControlled(page.locator("#email"), email);
  await fillControlled(page.locator("#password"), PASSWORD);
  await fillControlled(page.locator("#confirmPassword"), PASSWORD);
  await page.getByRole("button", { name: /załóż konto/i }).click();
  await expectToLeave(page, "/auth/signup", "Sign up");

  // Signing in explicitly keeps the test independent of whether sign-up
  // returned a session on its own.
  await page.goto("/auth/signin");
  await waitForHydration(page);
  await fillControlled(page.locator("#email"), email);
  await fillControlled(page.locator("#password"), PASSWORD);
  await page.getByRole("button", { name: /zaloguj/i }).click();
  await expectToLeave(page, "/auth/signin", "Sign in");

  await page.goto("/topics");
  await expect(page.getByTestId("current-user")).toHaveText(email);

  return email;
}

/** Declares minutes available on each weekday, Monday first. */
export async function setAvailability(page: Page, minutesPerDay: number[]): Promise<void> {
  await page.goto("/topics");
  await waitForHydration(page);

  for (const [weekday, minutes] of minutesPerDay.entries()) {
    await fillControlled(page.getByTestId(`availability-${weekday}`), String(minutes));
  }

  await page.getByTestId("save-availability").click();
  await expect(page.getByTestId("flash-ok")).toContainText("Zapisano dostępność");
}

export async function addTopic(
  page: Page,
  topic: { title: string; estimateMinutes: number; priority?: number; deadline?: string },
): Promise<void> {
  await page.goto("/topics");

  // The topic form is plain server-rendered markup, so it needs no hydration
  // wait: the fields are never re-controlled after load.
  await page.getByTestId("topic-title").fill(topic.title);
  await page.getByTestId("topic-estimate").fill(String(topic.estimateMinutes));

  if (topic.priority !== undefined) {
    await page.getByTestId("topic-priority").selectOption(String(topic.priority));
  }
  if (topic.deadline !== undefined) {
    await page.getByTestId("topic-deadline").fill(topic.deadline);
  }

  await page.getByTestId("add-topic").click();
  await expect(page.getByTestId("flash-ok")).toContainText("Dodano temat");
}
