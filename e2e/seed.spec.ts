// Risk: topic edits are lost between HTML form submission, DB and SSR reload.
// Seed for new tests: unique data, real auth fixture, semantic locators, cleanup.
import { expect } from "@playwright/test";
import { test } from "./authenticated";
import { addTopic } from "./helpers";

test("an edited topic survives reload and remains searchable", async ({ page }) => {
  const title = `Sieci ${Date.now()}`;
  await addTopic(page, { title, estimateMinutes: 120 });
  const item = page.getByTestId("topic-item");
  await item.getByLabel("Tytuł", { exact: true }).fill(`${title} TCP`);
  await item.getByLabel("Minuty", { exact: true }).fill("180");
  await item.getByRole("button", { name: "Zapisz", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Zaktualizowano temat");
  await page.reload();
  await expect(item.getByLabel("Tytuł", { exact: true })).toHaveValue(`${title} TCP`);
  await expect(item.getByLabel("Minuty", { exact: true })).toHaveValue("180");

  await page.getByRole("searchbox", { name: "Szukaj tematu" }).fill("brak-dopasowania");
  await page.getByRole("button", { name: "Filtruj" }).click();
  await expect(item).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Brak pasujących tematów");
  await page.getByRole("link", { name: "Wyczyść" }).click();
  await expect(item).toHaveCount(1);
});
