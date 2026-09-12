import { test } from "@playwright/test";

import { addTopic, nextWeekMonday, registerAndSignIn, setAvailability } from "./helpers";

/**
 * Not an assertion suite. Renders each surface in both colour schemes so the
 * result can actually be looked at rather than assumed.
 *
 * Run with: npx playwright test shots.spec.ts
 */
for (const scheme of ["light", "dark"] as const) {
  test.describe(`${scheme} mode`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 1280, height: 900 } });

    test(`captures every surface in ${scheme}`, async ({ page }) => {
      await page.goto("/");
      await page.screenshot({ path: `shots/${scheme}-landing.png`, fullPage: true });

      await page.goto("/auth/signup");
      await page.screenshot({ path: `shots/${scheme}-signup.png` });

      await page.goto("/auth/signin");
      await page.screenshot({ path: `shots/${scheme}-signin.png` });

      await registerAndSignIn(page);
      await setAvailability(page, [60, 60, 0, 90, 0, 120, 45]);
      await addTopic(page, { title: "Protokoły routingu", estimateMinutes: 180, priority: 4 });
      await addTopic(page, { title: "Ćwiczenia z podsieci", estimateMinutes: 240, priority: 3 });
      await addTopic(page, { title: "Listy kontroli dostępu", estimateMinutes: 120, priority: 5 });

      await page.screenshot({ path: `shots/${scheme}-topics.png`, fullPage: true });

      await page.goto(`/dashboard?week=${nextWeekMonday()}`);
      await page.getByTestId("generate-plan").click();
      await page.getByTestId("mark-done").first().click();
      await page.screenshot({ path: `shots/${scheme}-dashboard.png`, fullPage: true });
    });
  });
}
