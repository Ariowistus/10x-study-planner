import { expect, type Page } from "@playwright/test";

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

/** Registers an account and leaves the browser signed in. */
export async function registerAndSignIn(page: Page): Promise<string> {
  const email = uniqueEmail();

  await page.goto("/auth/signup");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.locator("#confirmPassword").fill(PASSWORD);
  await page.getByRole("button", { name: /create account/i }).click();

  // Local Supabase has email confirmation disabled, but signing in explicitly
  // keeps the test independent of that setting.
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/signup"));

  await page.goto("/auth/signin");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL((url) => !url.pathname.startsWith("/auth/signin"));

  await page.goto("/topics");
  await expect(page.getByTestId("current-user")).toHaveText(email);

  return email;
}

/** Declares the same number of minutes on every weekday. */
export async function setAvailability(page: Page, minutesPerDay: number[]): Promise<void> {
  await page.goto("/topics");

  for (const [weekday, minutes] of minutesPerDay.entries()) {
    await page.getByTestId(`availability-${weekday}`).fill(String(minutes));
  }

  await page.getByTestId("save-availability").click();
  await expect(page.getByTestId("flash-ok")).toContainText("Availability saved");
}

export async function addTopic(
  page: Page,
  topic: { title: string; estimateMinutes: number; priority?: number; deadline?: string },
): Promise<void> {
  await page.goto("/topics");

  await page.getByTestId("topic-title").fill(topic.title);
  await page.getByTestId("topic-estimate").fill(String(topic.estimateMinutes));

  if (topic.priority !== undefined) {
    await page.getByTestId("topic-priority").selectOption(String(topic.priority));
  }
  if (topic.deadline !== undefined) {
    await page.getByTestId("topic-deadline").fill(topic.deadline);
  }

  await page.getByTestId("add-topic").click();
  await expect(page.getByTestId("flash-ok")).toContainText("Topic added");
}
