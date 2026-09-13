// Risk: editing/deleting completed work corrupts progress. Completion must be undone first.
import { expect } from "@playwright/test";
import { test } from "./authenticated";
import { addEntry, nextWeekMonday } from "./helpers";
test("completed work cannot be edited or deleted until undone", async ({ page }) => {
  const date = nextWeekMonday();
  await addEntry(page, { title: "Angielski", date });
  await addEntry(page, { title: "Angielski", date, time: "14:00" });
  await page.goto("/dashboard?week=" + date);
  await page.getByTestId("mark-done").first().click();
  await expect(page.getByTestId("progress-percent")).toHaveText("50");
  await page.reload();
  await expect(page.getByTestId("completed-minutes")).toHaveText("1 godz.");
  await page.getByRole("link", { name: "Szczegóły" }).first().click();
  const item = page.getByTestId("calendar-session").first();
  await expect(item.getByTestId("panel-delete-session")).toBeDisabled();
  await expect(item.getByText("Edytuj zajęcie", { exact: true })).toHaveCount(0);
  const endpoint = await item
    .getByRole("button", { name: "Cofnij ukończenie" })
    .evaluate((button) => (button as HTMLButtonElement).form?.action ?? "");
  const forms: Record<string, string>[] = [
    { _action: "delete", month: date },
    { _action: "update", month: date, newTopicTitle: "Zmienione", date, startTime: "11:00", minutes: "15" },
  ];
  for (const form of forms) {
    const response = await page.request.post(endpoint, {
      form,
      headers: { origin: new URL(page.url()).origin },
      maxRedirects: 0,
    });
    expect(response.headers().location).toContain("error=");
  }
  await item.getByRole("button", { name: "Cofnij ukończenie" }).click();
  await page.reload();
  await item.getByTestId("panel-delete-session").click();
  await page.goto("/dashboard?week=" + date);
  await expect(page.getByTestId("session")).toHaveCount(1);
  await expect(page.getByTestId("completed-minutes")).toHaveText("0 min");
  await expect(page.getByTestId("progress-percent")).toHaveText("0");
});
