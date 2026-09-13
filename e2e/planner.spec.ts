import { expect, test as visitor } from "@playwright/test";
import { test } from "./authenticated";
import {
  addEntry,
  addTopic,
  generateWeek,
  nextWeekMonday,
  plusDays,
  registerAndSignIn,
  setAvailability,
} from "./helpers";

// Product scope changed: entries replace the old topic/budget wizard.
// Generator regression tests remain at its API boundary; domain allocation tests remain unchanged.
for (const path of ["/dashboard", "/calendar", "/topics"]) {
  visitor("protects " + path + " from anonymous visitors", async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
}
visitor("a new learner registers, lands on Realizacja and signs out", async ({ page }) => {
  await registerAndSignIn(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Realizacja");
  await expect(page.getByTestId("session")).toHaveCount(0);
  await page.getByRole("button", { name: "Wyloguj się" }).click();
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth\/signin/);
});

test("only Realizacja and Kalendarz are in navigation, old bookmarks redirect", async ({ page }) => {
  await page.goto("/dashboard");
  const nav = page.getByRole("navigation", { name: "Główna" });
  await expect(nav.getByRole("link")).toHaveText(["Realizacja", "Kalendarz"]);
  await expect(page.getByTestId("generate-plan")).toHaveCount(0);
  await page.goto("/topics");
  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole("form", { name: "Nowe zajęcie" })).toBeVisible();
});

test("two English blocks appear in time order with shared progress and status filtering", async ({ page }) => {
  const date = nextWeekMonday();
  await addEntry(page, { title: "Angielski", date, time: "14:00" });
  await addEntry(page, { title: "Angielski", date, time: "09:00" });
  await expect(page.getByTestId("calendar-session").first()).toContainText("09:00–10:00");
  await page.goto("/dashboard?week=" + date);
  await expect(page.getByTestId("session")).toHaveCount(2);
  await expect(page.getByTestId("progress-item")).toHaveCount(1);
  await expect(page.getByTestId("progress-percent")).toHaveText("0");
  await page.getByTestId("mark-done").first().click();
  await expect(page.getByTestId("progress-percent")).toHaveText("50");
  await page.getByRole("combobox", { name: "Status zajęć" }).selectOption("done");
  await page.getByRole("button", { name: "Filtruj" }).click();
  await expect(page.getByTestId("session")).toHaveCount(1);
  await expect(page.getByTestId("session")).toContainText("09:00–10:00");
});

test("calendar changes months and selects a day without a separate planning step", async ({ page }) => {
  const date = nextWeekMonday();
  await page.goto("/calendar?month=" + date + "&day=" + date);
  await page.getByRole("link", { name: plusDays(date, 1) + ", 0 zajęć", exact: true }).click();
  await expect(page.getByRole("form", { name: "Nowe zajęcie" }).getByLabel("Dzień")).toHaveValue(plusDays(date, 1));
  const current = await page.getByTestId("month-name").textContent();
  await page.getByRole("link", { name: "Następny miesiąc" }).click();
  await expect(page.getByTestId("month-name")).not.toHaveText(current ?? "");
  await page.getByRole("link", { name: "Poprzedni miesiąc" }).click();
  await expect(page.getByTestId("month-name")).toHaveText(current ?? "");
});

test("moving an entry to another day changes both the calendar and realization", async ({ page }) => {
  const date = nextWeekMonday(),
    other = plusDays(date, 1);
  await addEntry(page, { title: "Czytanie", date });
  await page.getByText("Edytuj zajęcie", { exact: true }).click();
  const form = page.getByRole("form", { name: "Edytuj Czytanie" });
  await form.getByLabel("Dzień").fill(other);
  await form.getByRole("button", { name: "Zapisz zmiany" }).click();
  await expect(page).toHaveURL(new RegExp("day=" + other));
  await page.goto("/calendar?month=" + date + "&day=" + date);
  await expect(page.getByTestId("calendar-session")).toHaveCount(0);
  await page.goto("/dashboard?week=" + date);
  await expect(page.getByTestId("day-card")).toHaveAttribute("data-date", other);
});

test("blank hour remains explicitly untimed across reload and export", async ({ page }) => {
  const date = nextWeekMonday();
  await addEntry(page, { title: "Słówka", date, time: "" });
  await page.reload();
  await expect(page.getByTestId("calendar-session")).toContainText("Bez godziny");
  const response = await page.request.get("/api/plan/export?week=" + date);
  expect(await response.text()).toContain("DTSTART;VALUE=DATE:" + date.replaceAll("-", ""));
});

test("overlaps are rejected atomically while back-to-back entries are allowed", async ({ page }) => {
  const date = nextWeekMonday();
  await addEntry(page, { title: "Angielski", date });
  const response = await page.request.post("/api/sessions", {
    form: { newTopicTitle: "Kolizja", date, startTime: "09:30", minutes: 60 },
    headers: { origin: new URL(page.url()).origin },
    maxRedirects: 0,
  });
  expect(decodeURIComponent(response.headers().location)).toContain("nakładają");
  await page.reload();
  await expect(page.getByTestId("calendar-session")).toHaveCount(1);
  const topics = await page.request.get("/api/topics");
  expect(await topics.json()).toEqual([expect.objectContaining({ title: "Angielski" })]);
  await addEntry(page, { title: "Matematyka", date, time: "10:00" });
  await expect(page.getByTestId("calendar-session")).toHaveCount(2);
});

test("simultaneous requests cannot reserve the same hour twice", async ({ page }) => {
  const date = nextWeekMonday();
  await page.goto("/calendar");
  const results = await Promise.all(
    ["A", "B"].map((title) =>
      page.request.post("/api/sessions", {
        form: { newTopicTitle: title, date, startTime: "09:00", minutes: 60 },
        headers: { origin: new URL(page.url()).origin },
        maxRedirects: 0,
      }),
    ),
  );
  expect(results.filter((r) => r.headers().location.includes("ok="))).toHaveLength(1);
  expect(results.filter((r) => r.headers().location.includes("error="))).toHaveLength(1);
  await page.goto("/calendar?month=" + date + "&day=" + date);
  await expect(page.getByTestId("calendar-session")).toHaveCount(1);
});

for (const input of [
  { minutes: 0 },
  { minutes: 1441 },
  { startTime: "25:00" },
  { startTime: "23:30", minutes: 60 },
  { date: "2026-02-29" },
  { newTopicTitle: "" },
]) {
  test("rejects invalid calendar input " + JSON.stringify(input), async ({ page }) => {
    const date = nextWeekMonday();
    await page.goto("/calendar");
    const response = await page.request.post("/api/sessions", {
      form: { newTopicTitle: "Błędne", date, startTime: "09:00", minutes: 60, ...input },
      headers: { origin: new URL(page.url()).origin },
      maxRedirects: 0,
    });
    expect(response.headers().location).toContain("error=");
    const topics = await page.request.get("/api/topics");
    expect(await topics.json()).toEqual([]);
  });
}

test("number input replaces its initial value and accepts a normal duration", async ({ page }) => {
  await page.goto("/calendar");
  const input = page.getByRole("form", { name: "Nowe zajęcie" }).getByLabel("Czas (min)");
  await input.focus();
  await input.press("End");
  await input.blur();
  await input.focus();
  await input.pressSequentially("90");
  await expect(input).toHaveValue("90");
});

test("forged cross-origin writes are blocked", async ({ page }) => {
  await page.goto("/calendar");
  const response = await page.request.post("/api/sessions", {
    form: { newTopicTitle: "CSRF", date: nextWeekMonday(), startTime: "09:00", minutes: 60 },
    headers: { origin: "https://untrusted.example" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(403);
});

test("another learner cannot see, edit, complete or delete an entry by its id", async ({ page, browser }) => {
  const date = nextWeekMonday();
  await addEntry(page, { title: "Prywatne zajęcie", date });
  const endpoint = await page
    .getByTestId("panel-mark-done")
    .evaluate((button) => (button as HTMLButtonElement).form?.action ?? "");
  const other = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const otherPage = await other.newPage();
  try {
    await registerAndSignIn(otherPage);
    await otherPage.goto("/calendar?month=" + date + "&day=" + date);
    await expect(otherPage.getByTestId("calendar-session")).toHaveCount(0);
    const list = await otherPage.request.get("/api/topics");
    expect(await list.json()).toEqual([]);
    const forms: Record<string, string>[] = [
      { _action: "delete" },
      { status: "done" },
      { _action: "update", newTopicTitle: "Atak", date, startTime: "11:00", minutes: "60" },
    ];
    for (const form of forms) {
      const response = await otherPage.request.post(endpoint, {
        form,
        headers: { origin: new URL(page.url()).origin },
        maxRedirects: 0,
      });
      expect(response.headers().location).toContain("error=");
    }
    await page.reload();
    await expect(page.getByTestId("calendar-session")).toContainText("Prywatne zajęcie");
    await expect(page.getByTestId("calendar-session")).toContainText("do zrobienia");
  } finally {
    await other.close();
  }
});

test("legacy generation still respects daily capacity and preserves completed history", async ({ page }) => {
  const date = nextWeekMonday();
  await setAvailability(page, [60, 60, 0, 0, 0, 0, 0]);
  await addTopic(page, { title: "Sieci", estimateMinutes: 120 });
  await generateWeek(page, date);
  await expect(page.getByTestId("session")).toHaveCount(2);
  await expect(page.getByTestId("day-card")).toHaveCount(2);
  await expect(page.getByTestId("session").first()).toContainText("60 min");
  await page.getByTestId("mark-done").first().click();
  await generateWeek(page, date);
  await expect(page.getByTestId("session")).toHaveCount(2);
  await expect(page.getByTestId("mark-planned")).toHaveCount(1);
  await expect(page.getByTestId("progress-percent")).toHaveText("50");
});

test("legacy regeneration keeps manual reservations without planning duplicate work", async ({ page }) => {
  const date = nextWeekMonday();
  await setAvailability(page, [120, 0, 0, 0, 0, 0, 0]);
  await addEntry(page, { title: "Angielski", date, minutes: 60 });
  await generateWeek(page, date);
  await expect(page.getByTestId("session")).toHaveCount(1);
  await expect(page.getByTestId("session")).toContainText("09:00–10:00");
});
