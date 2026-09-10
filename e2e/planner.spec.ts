import { expect, test } from "@playwright/test";

import { addTopic, nextWeekMonday, plusDays, registerAndSignIn, setAvailability } from "./helpers";

/**
 * The flow the certification asks to be covered: a learner reaches a plan and
 * records progress against it.
 *
 * Every planning test works on next week. The planner will not schedule days
 * that have already passed, so planning the current week would give the suite a
 * different number of usable evenings depending on the day it runs.
 */

test.describe("access control", () => {
  // US-001
  test("sends an unauthenticated visitor to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("protects the topics page as well", async ({ page }) => {
    await page.goto("/topics");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});

test.describe("planning a week", () => {
  // SC-1, US-003, US-006, US-008, US-012, US-015
  test("a learner registers, plans a week and completes a session", async ({ page }) => {
    await registerAndSignIn(page);

    // One hour on Monday and Tuesday, nothing for the rest of the week.
    await setAvailability(page, [60, 60, 0, 0, 0, 0, 0]);
    await addTopic(page, { title: "Routing protocols", estimateMinutes: 120, priority: 4 });

    await page.goto(`/dashboard?week=${nextWeekMonday()}`);
    await expect(page.getByTestId("plan-empty")).toBeVisible();

    await page.getByTestId("generate-plan").click();
    await expect(page.getByTestId("flash-ok")).toContainText("Planned 2 sessions");

    // Two hours of work against two one-hour evenings.
    const sessions = page.getByTestId("session");
    await expect(sessions).toHaveCount(2);
    await expect(sessions.first()).toContainText("Routing protocols");
    await expect(sessions.first()).toContainText("60 min");

    await expect(page.getByTestId("planned-minutes")).toHaveText("2 h");
    await expect(page.getByTestId("completed-minutes")).toHaveText("0 min");

    // Completing a session moves the topic's progress (US-012).
    await page.getByTestId("mark-done").first().click();
    await expect(page.getByTestId("flash-ok")).toContainText("Session marked done");

    await expect(page.getByTestId("completed-minutes")).toHaveText("1 h");
    await expect(page.getByTestId("planned-minutes")).toHaveText("1 h");
    await expect(page.getByTestId("progress-percent").first()).toHaveText("50");
  });

  // US-007: a day with no availability stays empty.
  test("respects a day the learner keeps free", async ({ page }) => {
    await registerAndSignIn(page);

    await setAvailability(page, [90, 0, 0, 0, 0, 0, 0]);
    await addTopic(page, { title: "Subnetting drills", estimateMinutes: 300 });

    await page.goto(`/dashboard?week=${nextWeekMonday()}`);
    await page.getByTestId("generate-plan").click();

    const days = page.getByTestId("day-card");
    await expect(days).toHaveCount(7);

    // Only Monday carries work, and never more than was declared.
    await expect(days.nth(0).getByTestId("day-total")).toHaveText("90");
    for (const index of [1, 2, 3, 4, 5, 6]) {
      await expect(days.nth(index).getByTestId("day-total")).toHaveText("0");
    }
  });

  // US-009: deadline pressure outranks a larger topic with a distant horizon.
  test("schedules the topic due soonest first", async ({ page }) => {
    await registerAndSignIn(page);

    const monday = nextWeekMonday();
    await setAvailability(page, [60, 0, 0, 0, 0, 0, 0]);

    await addTopic(page, { title: "Exam revision", estimateMinutes: 60, deadline: plusDays(monday, 1) });
    await addTopic(page, { title: "Background reading", estimateMinutes: 300 });

    await page.goto(`/dashboard?week=${monday}`);
    await page.getByTestId("generate-plan").click();

    const sessions = page.getByTestId("session");
    await expect(sessions).toHaveCount(1);
    await expect(sessions.first()).toContainText("Exam revision");
  });

  // The planner does not put work on evenings that have already gone.
  test("does not schedule days that have already passed", async ({ page }) => {
    await registerAndSignIn(page);

    await setAvailability(page, [60, 60, 60, 60, 60, 60, 60]);
    await addTopic(page, { title: "Everything", estimateMinutes: 3000 });

    // The current week: some of it is behind us unless today is Monday.
    await page.goto("/dashboard");
    await page.getByTestId("generate-plan").click();

    const today = new Date();
    const mondayIndex = (today.getDay() + 6) % 7;

    const days = page.getByTestId("day-card");
    for (let index = 0; index < mondayIndex; index += 1) {
      await expect(days.nth(index).getByTestId("day-total")).toHaveText("0");
    }
    await expect(days.nth(mondayIndex).getByTestId("day-total")).toHaveText("60");
  });
});

test.describe("managing topics", () => {
  // US-005
  test("a deleted topic disappears from the list", async ({ page }) => {
    await registerAndSignIn(page);

    await addTopic(page, { title: "Temporary topic", estimateMinutes: 60 });
    await expect(page.getByTestId("topic-item")).toHaveCount(1);

    await page.getByTestId("delete-topic").first().click();
    await expect(page.getByTestId("flash-ok")).toContainText("Topic deleted");
    await expect(page.getByTestId("topics-empty")).toBeVisible();
  });

  // FR-002 validation: the API rejects nonsense before it reaches the database.
  test("rejects a topic with a zero estimate", async ({ page }) => {
    await registerAndSignIn(page);

    await page.goto("/topics");
    await page.getByTestId("topic-title").fill("Impossible topic");
    await page.getByTestId("topic-estimate").fill("0");
    await page.getByTestId("add-topic").click();

    await expect(page.getByTestId("flash-error")).toBeVisible();
    await expect(page.getByTestId("topics-empty")).toBeVisible();
  });
});

test.describe("isolation", () => {
  // SC-5: two learners never see each other's data.
  test("a second learner starts with an empty account", async ({ page }) => {
    await registerAndSignIn(page);
    await addTopic(page, { title: "First learner topic", estimateMinutes: 60 });
    await expect(page.getByTestId("topic-item")).toHaveCount(1);

    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/topics"));

    await registerAndSignIn(page);
    await expect(page.getByTestId("topics-empty")).toBeVisible();
  });
});
