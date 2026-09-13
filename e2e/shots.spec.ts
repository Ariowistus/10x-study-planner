// Optional visual inspection tool; the functional specs carry assertions.
import { test } from "./authenticated";
import { addEntry, nextWeekMonday } from "./helpers";
for (const scheme of ["light", "dark"] as const) {
  test("captures the two-view workspace in " + scheme, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const date = nextWeekMonday();
    await addEntry(page, { title: "Angielski · konwersacje", date, time: "09:00" });
    await addEntry(page, { title: "Angielski · konwersacje", date, time: "14:00", minutes: 45 });
    await addEntry(page, { title: "Matematyka · zadania egzaminacyjne", date, time: "17:00", minutes: 90 });
    await page.goto("/dashboard?week=" + date);
    await page.getByTestId("mark-done").first().click();
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ["dashboard", "calendar"]) {
        await page.goto("/" + route + (route === "calendar" ? "?month=" + date + "&day=" + date : "?week=" + date));
        await page.screenshot({
          path: "shots/" + scheme + "-" + route + "-" + String(width) + ".png",
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  });
}
