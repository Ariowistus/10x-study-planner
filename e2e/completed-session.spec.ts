// Risk: deleting a completed session leaves phantom topic progress.
// Seed: seed.spec.ts; real auth, HTTP mutations, DB and SSR, no mocks.
import { expect } from "@playwright/test";
import { test } from "./authenticated";
import { addTopic, nextWeekMonday, setAvailability } from "./helpers";

test("completed work must be undone before its session can be deleted", async ({ page }) => {
  await setAvailability(page, [60, 0, 0, 0, 0, 0, 0]);
  await addTopic(page, { title: `Postęp ${Date.now()}`, estimateMinutes: 120 });
  const monday = nextWeekMonday();
  await page.goto(`/dashboard?week=${monday}`);
  await page.getByRole("button", { name: "Wygeneruj plan" }).click();
  await page.getByTestId("mark-done").click();
  await expect(page.getByTestId("progress-percent")).toHaveText("50");
  await page.goto(`/calendar?month=${monday}&day=${monday}`);
  const undo = page.getByRole("button", { name: "Cofnij ukończenie" });
  await expect(undo).toBeVisible();
  await expect(page.getByTestId("panel-delete-session")).toBeDisabled();
  const endpoint = await undo.evaluate((button) => (button as HTMLButtonElement).form?.action ?? "");
  const response = await page.request.post(endpoint, {
    form: { _action: "delete", month: monday },
    headers: { origin: new URL(page.url()).origin },
    maxRedirects: 0,
  });
  expect(response.headers().location).toContain("error=");
  await page.reload();
  await expect(undo).toBeVisible();
  await undo.click();
  await expect(page.getByRole("status")).toContainText("Oznaczono sesję jako zaplanowaną");
  await page.goto(`/calendar?month=${monday}&day=${monday}`);
  await page.getByTestId("panel-delete-session").click();
  await expect(page.getByRole("status")).toContainText("Usunięto sesję");
  await page.goto(`/dashboard?week=${monday}`);
  await expect(page.getByTestId("session")).toHaveCount(0);
  await expect(page.getByTestId("progress-percent")).toHaveText("0");
});
