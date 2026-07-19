import { chromium } from "playwright";

const accessToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYTc4ZTdkMi02ZjM5LTQ2MjQtOTE5Ni1jZGU4MjgzYmEzNDAiLCJyb2xlIjoiQURNSU4iLCJleHAiOjE3ODUwNjU1OTB9.65Nl7_dFL3hTyngEBci8yzkDwKdJNixoMoEK19WaLDE";
const apiBase = "https://mziyrhutfmtdczggemhe.supabase.co/functions/v1";
const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

const [meResponse, dashboardResponse] = await Promise.all([
  fetch(`${apiBase}/access-auth/me`, { headers }),
  fetch(`${apiBase}/access-admin/dashboard`, { headers }),
]);

const me = await meResponse.json();
const dashboard = await dashboardResponse.json();
if (!meResponse.ok) throw new Error(`Access /me failed (${meResponse.status}): ${me.message ?? "unknown"}`);
if (!dashboardResponse.ok) throw new Error(`Dashboard failed (${dashboardResponse.status}): ${dashboard.message ?? "unknown"}`);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1612, height: 900 },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
});
await context.addCookies([{
  name: "_vcrcs",
  value: "1.1784457802.3600.YWUzY2Y1NjQyMTFiOWExMTYyYWQyYTM5M2IwODc2MWQ=.111424ba50ca0add50f7c13b2b54fd95",
  domain: "www.choice-pc-sv.xyz",
  path: "/",
  secure: true,
}]);

const page = await context.newPage();
await page.addInitScript(({ token, user }) => {
  localStorage.setItem("access_token", token);
  localStorage.setItem("access_user", JSON.stringify(user));
  localStorage.setItem("access_login_time", String(Date.now()));
}, { token: accessToken, user: me.user });

await page.goto("https://www.choice-pc-sv.xyz/access/dashboard", {
  waitUntil: "domcontentloaded",
  timeout: 90000,
});
await page.waitForTimeout(15000);
await page.screenshot({ path: "live-admin-dashboard.png", fullPage: true });
const bodyText = await page.locator("body").innerText();
console.log(JSON.stringify({
  apiStatus: dashboardResponse.status,
  url: page.url(),
  role: me.user?.role,
  stats: dashboard.stats,
  hasNotFound: bodyText.includes("Not found"),
}));
await browser.close();
