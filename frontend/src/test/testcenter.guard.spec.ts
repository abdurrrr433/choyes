import { test, expect } from "@playwright/test";

const adminToken = (() => {
  const header = btoa(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ login: "admin-user", role: "USER", exp: Math.floor(Date.now() / 1000) + 3600 }));
  return `${header}.${payload}.`;
})();

const testCenterId = "123";

test.describe("Test center route guards", () => {
  test.beforeEach(async ({ page }) => {
    page.on("console", (message) => {
      console.log("browser console:", message.text());
    });

    page.on("pageerror", (error) => {
      console.log("browser pageerror:", error.message);
    });

    page.on("requestfailed", (request) => {
      console.log(`requestfailed: ${request.url()} ${request.failure()?.errorText}`);
    });

    page.on("request", (request) => {
      console.log(`request: ${request.method()} ${request.url()}`);
    });

    await page.addInitScript(({ token }) => {
      localStorage.setItem("accessToken", token);
    }, { token: adminToken });

    await page.route("**/svp-proxy/test_centers/*/validate_access", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ access: true }),
      });
    });
  });

  test("allows authenticated user to open guarded test center detail route", async ({ page }) => {
    await page.goto(`/exam/test-centers/${testCenterId}`);
    console.log("navigated to", page.url());
    const bodyText = await page.locator("body").innerText();
    console.log("body text", bodyText.slice(0, 400));
    const html = await page.evaluate(() => document.body.innerHTML);
    console.log("body html", html.slice(0, 800));
    await expect(page.locator("text=Test Center 123 Details")).toBeVisible();
    await expect(page.locator("[data-testid=test-center-access-granted]")).toContainText("Test center access has been validated");
  });
});
