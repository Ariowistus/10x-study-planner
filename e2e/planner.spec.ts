import { expect, test } from "@playwright/test";

import { addTopic, nextWeekMonday, plusDays, registerAndSignIn, setAvailability, waitForHydration } from "./helpers";

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
    await expect(page.getByTestId("flash-ok")).toContainText("Zaplanowano 2 sesje");

    // Two hours of work against two one-hour evenings.
    const sessions = page.getByTestId("session");
    await expect(sessions).toHaveCount(2);
    await expect(sessions.first()).toContainText("Routing protocols");
    await expect(sessions.first()).toContainText("60 min");

    await expect(page.getByTestId("planned-minutes")).toHaveText("2 godz.");
    await expect(page.getByTestId("completed-minutes")).toHaveText("0 min");

    // Completing a session moves the topic's progress (US-012).
    await page.getByTestId("mark-done").first().click();
    await expect(page.getByTestId("flash-ok")).toContainText("Oznaczono sesję jako zrobioną");

    await expect(page.getByTestId("completed-minutes")).toHaveText("1 godz.");
    await expect(page.getByTestId("planned-minutes")).toHaveText("1 godz.");
    await expect(page.getByTestId("progress-percent").first()).toHaveText("50");
  });

  // S-02 plan, manual gate step 7.2: regeneration must not resurrect settled work.
  test("regenerating the week does not resurrect a completed session", async ({ page }) => {
    await registerAndSignIn(page);

    // One hour on Monday and Tuesday against two hours of work, so the topic
    // needs both evenings and each evening holds exactly one session.
    await setAvailability(page, [60, 60, 0, 0, 0, 0, 0]);
    await addTopic(page, { title: "Spanning tree protocol", estimateMinutes: 120, priority: 4 });

    await page.goto(`/dashboard?week=${nextWeekMonday()}`);
    await page.getByTestId("generate-plan").click();
    await expect(page.getByTestId("session")).toHaveCount(2);

    await page.getByTestId("mark-done").first().click();
    await expect(page.getByTestId("flash-ok")).toContainText("Oznaczono sesję jako zrobioną");
    await expect(page.getByTestId("completed-minutes")).toHaveText("1 godz.");

    const done = page.locator('[data-testid="session"][data-status="done"]');
    const planned = page.locator('[data-testid="session"][data-status="planned"]');
    await expect(done).toHaveCount(1);
    await expect(planned).toHaveCount(1);

    // Regenerating keeps sessions the learner already acted on and removes the
    // capacity they occupy, so the completed evening must survive untouched and
    // must not reappear as planned work.
    await page.getByTestId("generate-plan").click();
    await expect(page.getByTestId("flash-ok")).toBeVisible();

    await expect(done).toHaveCount(1);
    await expect(planned).toHaveCount(1);
    await expect(page.getByTestId("session")).toHaveCount(2);
    await expect(page.getByTestId("completed-minutes")).toHaveText("1 godz.");
    await expect(page.getByTestId("planned-minutes")).toHaveText("1 godz.");
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
  test("gives most of the evening to the topic due soonest", async ({ page }) => {
    await registerAndSignIn(page);

    const monday = nextWeekMonday();
    await setAvailability(page, [60, 0, 0, 0, 0, 0, 0]);

    await addTopic(page, { title: "Exam revision", estimateMinutes: 60, deadline: plusDays(monday, 1) });
    await addTopic(page, { title: "Background reading", estimateMinutes: 300 });

    await page.goto(`/dashboard?week=${monday}`);
    await page.getByTestId("generate-plan").click();

    // Urgency is the daily pace a topic needs to finish on time, so the topic
    // due tomorrow takes the bulk of the hour. It does not take all of it: once
    // only a quarter of an hour is left on it, its required pace falls below
    // that of a much larger topic, and the last block goes there. That is the
    // rule behaving as specified rather than a defect — see the note on
    // deadlines as cliffs in context/foundation/lessons.md.
    const urgent = page.getByTestId("session").filter({ hasText: "Exam revision" });
    const background = page.getByTestId("session").filter({ hasText: "Background reading" });

    await expect(urgent).toHaveCount(1);
    await expect(urgent).toContainText("45 min");
    await expect(background).toContainText("15 min");
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
  // A controlled number input kept its leading zero: React compares the field
  // with `node.value != props.value`, and "0120" is loosely equal to 120, so it
  // left the DOM showing 0120 while the state held 120.
  test("typing into an availability field replaces the zero rather than appending", async ({ page }) => {
    await registerAndSignIn(page);
    await page.goto("/topics");
    await waitForHydration(page);

    const monday = page.getByTestId("availability-0");
    await monday.click();
    // The caret has to sit behind the existing zero — that is the case the
    // browser does not repair on its own, and a click on the right-hand side of
    // a wide field lands exactly there.
    await page.keyboard.press("End");
    await page.keyboard.type("120");

    await expect(monday).toHaveValue("120");
    await expect(page.getByTestId("availability-total")).toHaveText("2 godz.");
  });

  // US-005
  test("a deleted topic disappears from the list", async ({ page }) => {
    await registerAndSignIn(page);

    await addTopic(page, { title: "Temporary topic", estimateMinutes: 60 });
    await expect(page.getByTestId("topic-item")).toHaveCount(1);

    await page.getByTestId("delete-topic").first().click();
    await expect(page.getByTestId("flash-ok")).toContainText("Usunięto temat");
    await expect(page.getByTestId("topics-empty")).toBeVisible();
  });

  // The browser refuses a zero estimate before anything is sent.
  test("will not submit a topic with a zero estimate", async ({ page }) => {
    await registerAndSignIn(page);

    await page.goto("/topics");
    await page.getByTestId("topic-title").fill("Impossible topic");
    await page.getByTestId("topic-estimate").fill("0");
    await page.getByTestId("add-topic").click();

    await expect(page.getByTestId("topic-estimate")).toHaveJSProperty("validity.valid", false);
    await expect(page.getByTestId("topics-empty")).toBeVisible();
  });

  // FR-002 validation, server side. Native validation is a convenience, not a
  // control: the endpoint has to refuse the same input when the browser is
  // taken out of the picture.
  test("the API refuses a zero estimate when the browser is bypassed", async ({ page }) => {
    await registerAndSignIn(page);
    const origin = new URL(page.url()).origin;
    const form = { title: "Impossible topic", estimatedMinutes: "0", priority: "3", deadline: "" };

    // A cross-origin post is rejected outright: Astro checks the origin of
    // every state-changing request, so a form on someone else's page cannot
    // act with this learner's session.
    const forged = await page.request.post("/api/topics", { form, maxRedirects: 0 });
    expect(forged.status()).toBe(403);

    // With a legitimate origin the request reaches the endpoint, and is then
    // turned away by validation rather than by the browser.
    const rejected = await page.request.post("/api/topics", {
      form,
      headers: { origin },
      maxRedirects: 0,
    });
    expect(rejected.status()).toBe(302);
    expect(rejected.headers().location).toContain("error=");

    await page.goto("/topics");
    await expect(page.getByTestId("topics-empty")).toBeVisible();
  });
});

test.describe("isolation", () => {
  // SC-5: two learners never see each other's data.
  test("a second learner starts with an empty account", async ({ page }) => {
    await registerAndSignIn(page);
    await addTopic(page, { title: "First learner topic", estimateMinutes: 60 });
    await expect(page.getByTestId("topic-item")).toHaveCount(1);

    await page.getByRole("button", { name: /wyloguj/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/topics"));

    await registerAndSignIn(page);
    await expect(page.getByTestId("topics-empty")).toBeVisible();
  });
});

test.describe("setting an evening from the plan", () => {
  // US-007 revisited: the learner should not have to leave the week they are
  // looking at to fix the minutes for one evening.
  test("saves a day's minutes from its card and plans against them", async ({ page }) => {
    await registerAndSignIn(page);
    await addTopic(page, { title: "Adresowanie IPv6", estimateMinutes: 90, priority: 4 });

    const week = nextWeekMonday();
    await page.goto(`/dashboard?week=${week}`);

    const monday = page.getByTestId("day-card").first();
    await expect(monday).toContainText("0 / 0 min");

    await monday.locator("summary").click();
    await page.getByTestId("day-minutes-0").fill("90");
    await page.getByTestId("save-day-0").click();

    await expect(page.getByTestId("flash-ok")).toContainText("Zapisano minuty");
    await expect(page.getByTestId("day-card").first()).toContainText("0 / 90 min");

    // The declared minutes are real: the planner now has an evening to use.
    await page.getByTestId("generate-plan").click();
    await expect(page.getByTestId("flash-ok")).toContainText("Zaplanowano 1 sesję");
    await expect(page.getByTestId("session")).toHaveCount(1);
  });

  test("rejects minutes longer than a day", async ({ page }) => {
    await registerAndSignIn(page);
    await page.goto(`/dashboard?week=${nextWeekMonday()}`);

    const response = await page.request.post("/api/availability", {
      form: { weekday: "0", minutes: "2000", week: nextWeekMonday() },
      headers: { origin: new URL(page.url()).origin },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toContain("error=");
  });
});

test.describe("calendar", () => {
  test("is closed to an unauthenticated visitor", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("shows the month, moves between months, and opens a day's week", async ({ page }) => {
    await registerAndSignIn(page);
    await page.goto("/calendar");

    const name = page.getByTestId("month-name");
    await expect(name).not.toBeEmpty();

    // A month grid always covers whole weeks, so it never shows fewer than 28
    // cells and never more than six rows of seven.
    const cells = page.getByTestId("calendar-day");
    const count = await cells.count();
    expect(count).toBeGreaterThanOrEqual(28);
    expect(count).toBeLessThanOrEqual(42);
    expect(count % 7).toBe(0);

    const shown = await name.textContent();
    await page.getByTestId("next-month").click();
    await expect(name).not.toHaveText(shown ?? "");

    await page.getByTestId("previous-month").click();
    await expect(name).toHaveText(shown ?? "");

    const day = page.locator('[data-testid="calendar-day"][data-in-month="true"]').first();
    await day.locator("summary").click();
    await day.getByRole("link", { name: /otwórz tydzień/i }).click();
    await expect(page).toHaveURL(/\/dashboard\?week=\d{4}-\d{2}-\d{2}/);
  });

  test("shows a session on the calendar once a week is planned", async ({ page }) => {
    await registerAndSignIn(page);
    await setAvailability(page, [60, 0, 0, 0, 0, 0, 0]);
    await addTopic(page, { title: "Protokoły trasowania", estimateMinutes: 60, priority: 4 });

    const week = nextWeekMonday();
    await page.goto(`/dashboard?week=${week}`);
    await page.getByTestId("generate-plan").click();
    await expect(page.getByTestId("session")).toHaveCount(1);

    await page.goto(`/calendar?month=${week}`);
    const monday = page.locator(`[data-testid="calendar-day"][data-date="${week}"]`);
    await expect(monday).toContainText("Protokoły trasowania");
    // The cell carries how long the session is, not just which topic it is.
    await expect(monday.getByTestId("calendar-session").first()).toContainText("60 min");
    // The header prints what is booked on the day.
    await expect(monday).toContainText("60 min");
  });
});

test.describe("planning a day from the calendar", () => {
  // The core of the calendar-first flow: open a day, name the work, say how
  // long, and it is on the calendar.
  test("adds a block to a day, then a second one, and keeps both", async ({ page }) => {
    await registerAndSignIn(page);

    const target = nextWeekMonday();
    await page.goto(`/calendar?month=${target}&day=${target}`);

    const cell = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await cell.getByTestId("panel-new-topic").fill("Protokoły routingu");
    await cell.getByTestId("panel-minutes").fill("120");
    await cell.getByTestId("panel-add-session").click();

    await expect(page.getByTestId("flash-ok")).toContainText("Dodano sesję");

    const afterFirst = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await expect(afterFirst).toContainText("Protokoły routingu");
    await expect(afterFirst).toContainText("120 min");

    // A second block on the same day, this time reusing the topic just created.
    await page.goto(`/calendar?month=${target}&day=${target}`);
    const reopened = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await reopened.getByTestId("panel-new-topic").fill("Ćwiczenia z podsieci");
    await reopened.getByTestId("panel-minutes").fill("90");
    await reopened.getByTestId("panel-add-session").click();

    const withBoth = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await expect(withBoth.getByTestId("calendar-session")).toHaveCount(2);
    await expect(withBoth).toContainText("Ćwiczenia z podsieci");
    await expect(withBoth).toContainText("90 min");
    // 120 + 90 booked on the day.
    await expect(withBoth).toContainText("210 min");
  });

  test("refuses a block with no topic at all", async ({ page }) => {
    await registerAndSignIn(page);

    const target = nextWeekMonday();
    const response = await page.request.post("/api/sessions", {
      form: { date: target, minutes: "60", topicId: "", newTopicTitle: "" },
      headers: { origin: new URL(page.url()).origin },
      maxRedirects: 0,
    });

    expect(response.status()).toBe(302);
    expect(response.headers().location).toContain("error=");
  });

  test("a block placed by hand survives regenerating the week", async ({ page }) => {
    await registerAndSignIn(page);

    const target = nextWeekMonday();
    await page.goto(`/calendar?month=${target}&day=${target}`);

    const cell = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await cell.getByTestId("panel-new-topic").fill("Blok postawiony ręcznie");
    await cell.getByTestId("panel-minutes").fill("45");
    await cell.getByTestId("panel-add-session").click();
    await expect(page.getByTestId("flash-ok")).toContainText("Dodano sesję");

    // Declare time and ask the rule to plan the same week. The hand-placed block
    // is a decision, not a suggestion: it must still be there afterwards.
    await setAvailability(page, [180, 0, 0, 0, 0, 0, 0]);
    await page.goto(`/dashboard?week=${target}`);
    await page.getByTestId("generate-plan").click();

    await page.goto(`/calendar?month=${target}`);
    const after = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await expect(after).toContainText("Blok postawiony ręcznie");
  });

  test("removes a block from the day panel", async ({ page }) => {
    await registerAndSignIn(page);

    const target = nextWeekMonday();
    await page.goto(`/calendar?month=${target}&day=${target}`);

    const cell = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await cell.getByTestId("panel-new-topic").fill("Do skasowania");
    await cell.getByTestId("panel-minutes").fill("30");
    await cell.getByTestId("panel-add-session").click();
    await expect(page.getByTestId("flash-ok")).toContainText("Dodano sesję");

    await page.goto(`/calendar?month=${target}&day=${target}`);
    await page
      .locator(`[data-testid="calendar-day"][data-date="${target}"]`)
      .getByTestId("panel-delete-session")
      .first()
      .click();

    await expect(page.getByTestId("flash-ok")).toContainText("Usunięto sesję");
    await expect(
      page.locator(`[data-testid="calendar-day"][data-date="${target}"]`).getByTestId("calendar-session"),
    ).toHaveCount(0);
  });
});

test.describe("typing a topic name", () => {
  // Typing the same name on two days must mean one topic, not two: otherwise
  // the progress for "Angielski" would be split across unrelated rows.
  test("reuses a topic that already exists instead of duplicating it", async ({ page }) => {
    await registerAndSignIn(page);

    const monday = nextWeekMonday();
    const tuesday = plusDays(monday, 1);

    await page.goto(`/calendar?month=${monday}&day=${monday}`);
    const first = page.locator(`[data-testid="calendar-day"][data-date="${monday}"]`);
    await first.getByTestId("panel-new-topic").fill("Angielski");
    await first.getByTestId("panel-minutes").fill("60");
    await first.getByTestId("panel-add-session").click();
    await expect(page.getByTestId("flash-ok")).toContainText("Dodano sesję");

    // Same name, different day, and deliberately in different case.
    await page.goto(`/calendar?month=${monday}&day=${tuesday}`);
    const second = page.locator(`[data-testid="calendar-day"][data-date="${tuesday}"]`);
    await second.getByTestId("panel-new-topic").fill("angielski");
    await second.getByTestId("panel-minutes").fill("30");
    await second.getByTestId("panel-add-session").click();
    await expect(page.getByTestId("flash-ok")).toContainText("Dodano sesję");

    // Both days carry a block…
    await expect(page.locator(`[data-testid="calendar-day"][data-date="${monday}"]`)).toContainText("60 min");
    await expect(page.locator(`[data-testid="calendar-day"][data-date="${tuesday}"]`)).toContainText("30 min");

    // …but there is still exactly one topic behind them.
    await page.goto("/topics");
    await expect(page.getByTestId("topic-item")).toHaveCount(1);
  });
});

test.describe("adding to a day that already has work", () => {
  // The affordance used to show only on empty days, so a day with a block on it
  // looked closed for business.
  test("still invites another block, and takes one", async ({ page }) => {
    await registerAndSignIn(page);

    const target = nextWeekMonday();
    await page.goto(`/calendar?month=${target}&day=${target}`);

    const cell = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await cell.getByTestId("panel-new-topic").fill("Angielski");
    await cell.getByTestId("panel-minutes").fill("60");
    await cell.getByTestId("panel-add-session").click();
    await expect(page.getByTestId("flash-ok")).toContainText("Dodano sesję");

    // Closed, with work on it, the cell still says it can take more.
    const filled = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await expect(filled.getByTestId("day-add-hint")).toBeVisible();

    // And opening it from that state reaches the form.
    await filled.locator("summary").click();
    await filled.getByTestId("panel-new-topic").fill("Matematyka");
    await filled.getByTestId("panel-minutes").fill("30");
    await filled.getByTestId("panel-add-session").click();

    const both = page.locator(`[data-testid="calendar-day"][data-date="${target}"]`);
    await expect(both.getByTestId("calendar-session")).toHaveCount(2);
    await expect(both).toContainText("90 min");
  });
});
