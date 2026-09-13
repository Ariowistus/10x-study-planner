// Risk: the focus island records work without consent or exports a different plan.
// Seed: seed.spec.ts; real auth, routing and DB, controlled browser clock only.
import { expect } from "@playwright/test";
import { test } from "./authenticated";
import { addTopic, nextWeekMonday, setAvailability, waitForHydration } from "./helpers";

test("focus timing and export preserve the plan until the learner records completion", async ({ page }) => {
  await setAvailability(page, [60, 60, 0, 0, 0, 0, 0]);
  const title = `Skupienie ${Date.now()}`;
  await addTopic(page, { title, estimateMinutes: 120 });
  const monday = nextWeekMonday();
  await page.goto(`/dashboard?week=${monday}`);
  await page.getByRole("button", { name: "Wygeneruj plan" }).click();
  await waitForHydration(page);
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const focus = page.getByRole("region", { name: "Najbliższa sesja nauki" });
  await expect(focus.getByRole("heading")).toHaveText(title);
  await focus.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.runFor(1000);
  await expect(focus.getByRole("timer")).toHaveText("24:59");
  await focus.getByRole("button", { name: "Pauza" }).click();
  await page.clock.runFor(2000);
  await expect(focus.getByRole("timer")).toHaveText("24:59");
  await focus.getByRole("button", { name: "Resetuj minutnik" }).click();
  await expect(focus.getByRole("timer")).toHaveText("25:00");
  await focus.getByRole("button", { name: "Start", exact: true }).click();
  await page.clock.fastForward(25 * 60 * 1000);
  await expect(focus.getByRole("timer")).toHaveText("00:00");
  await expect(focus.getByRole("status")).toContainText("Czas na przerwę");
  await expect(page.getByTestId("completed-minutes")).toHaveText("0 min");

  const exportLink = page.getByRole("link", { name: "Eksport do kalendarza (.ics)" });
  const response = await page.request.get((await exportLink.getAttribute("href")) ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/calendar");
  const calendar = await response.text();
  expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(2);
  expect(calendar).toContain(`SUMMARY:${title} (60 min)`);
  expect(calendar).toContain(`DTSTART;VALUE=DATE:${monday.replaceAll("-", "")}`);

  await focus.getByRole("button", { name: "Zakończ sesję (60 min)" }).click();
  await expect(page.getByTestId("completed-minutes")).toHaveText("1 godz.");
  await page.reload();
  await expect(page.getByTestId("progress-percent")).toHaveText("50");
});
