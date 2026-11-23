import { chromium } from "@playwright/test";
const out = process.argv[2]; const routes = process.argv.slice(3);
const b = await chromium.launch();
for (const [name, vp, scheme] of [["desktop",{width:1440,height:900},"light"],["mobile",{width:390,height:844},"dark"]]) {
  const ctx = await b.newContext({ viewport: vp, colorScheme: scheme });
  const p = await ctx.newPage();
  await p.goto("http://localhost:3100/auth/signin", { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', "e2e-playwright@perks-reminder.test");
  await p.fill('input[type="password"]', "perks-e2e-local-only");
  await p.getByRole("button", { name: /^sign in$/i }).click();
  await p.waitForURL((u) => !u.pathname.startsWith("/auth"), { timeout: 30000 });
  for (const r of routes) {
    let route = r;
    if (r === "EDIT") { await p.goto("http://localhost:3100/cards", { waitUntil: "networkidle" }); const href = await p.locator('a[href^="/cards/"][href$="/edit"]').first().getAttribute("href"); route = href; }
    await p.goto("http://localhost:3100" + route, { waitUntil: "networkidle" }); await p.waitForTimeout(500);
    const slug = route.replace(/^\//, "").replace(/[\/\[\]?=]/g, "_") || "home";
    await p.screenshot({ path: `${out}/${slug}-${name}-${scheme}.png` });
  }
  await ctx.close();
}
await b.close(); console.log("ok");
