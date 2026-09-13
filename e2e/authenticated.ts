import { test as base, expect } from "@playwright/test";
import { PASSWORD, uniqueEmail } from "./helpers";

/** A separate account per test, authenticated through the real HTTP boundary. */
export const test = base.extend({
  storageState: async ({ playwright, baseURL }, provideState) => {
    const origin = new URL(baseURL ?? "http://127.0.0.1:4321").origin;
    const request = await playwright.request.newContext({ baseURL: origin });
    const form = { email: uniqueEmail(), password: PASSWORD };
    const signup = await request.post("/api/auth/signup", { form, headers: { origin }, maxRedirects: 0 });
    expect(signup.headers().location).toBe("/auth/confirm-email");
    const signin = await request.post("/api/auth/signin", { form, headers: { origin }, maxRedirects: 0 });
    expect(signin.headers().location).toBe("/");
    await provideState(await request.storageState());
    await request.dispose();
  },
});

// Remove this account's study records even after a failed assertion. Test-only
// auth accounts remain in hosted Supabase; CI discards its whole local stack.
test.afterEach(async ({ page }) => {
  await page.goto("/topics");
  const remove = page.getByTestId("delete-topic");
  while (await remove.count()) {
    await remove.first().click();
    await expect(page.getByRole("status")).toContainText("Usunięto temat");
  }
});
