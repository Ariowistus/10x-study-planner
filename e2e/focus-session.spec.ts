// Risk: the focus island records work without consent or exports a different plan.
// Seed: seed.spec.ts; real auth, routing and DB, controlled browser clock only.
import { expect } from "@playwright/test";
import { test } from "./authenticated";
import { addEntry, nextWeekMonday, waitForHydration } from "./helpers";

test("focus timing and export preserve the plan until the learner records completion", async ({ page }) => {
  const title = "Angielski";
  const monday = nextWeekMonday();
  await addEntry(page, { title, date: monday, time: "09:00" });
  await addEntry(page, { title, date: monday, time: "14:00" });
  await page.goto("/dashboard?week=" + monday);
  await page.getByText("Minutnik skupienia · " + title, { exact: true }).click();
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
  expect(calendar).toContain(`DTSTART:${monday.replaceAll("-", "")}T090000`);

  await focus.getByRole("button", { name: "Zakończ sesję (60 min)" }).click();
  await expect(page.getByTestId("completed-minutes")).toHaveText("1 godz.");
  await page.reload();
  await expect(page.getByTestId("progress-percent")).toHaveText("50");
});
