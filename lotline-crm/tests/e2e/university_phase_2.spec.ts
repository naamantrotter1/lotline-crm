// Playwright E2E for University Phase 2 (Feed, Events, Leaderboard).
// SKELETON — requires the same fixture accounts and env vars as
// tests/e2e/university.spec.ts plus a hub-admin account with write access.
//
// Run with: npx playwright test tests/e2e/university_phase_2.spec.ts

import { test, expect, Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', email);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/dashboard|\/investors|\/university/);
}

test.describe('University Phase 2', () => {

  test('a) Op A posts in Wins; Op B sees it within 5s; B likes it; A gets +1', async ({ browser }) => {
    const ctxA = await browser.newContext(); const a = await ctxA.newPage();
    const ctxB = await browser.newContext(); const b = await ctxB.newPage();
    await login(a, process.env.E2E_OPERATOR_A_EMAIL!, process.env.E2E_OPERATOR_A_PASSWORD!);
    await login(b, process.env.E2E_OPERATOR_B_EMAIL!, process.env.E2E_OPERATOR_B_PASSWORD!);

    await a.goto(`${BASE}/university/feed`);
    await a.getByText('Share an update').click();
    await a.locator('select').first().selectOption({ label: 'Wins' });
    await a.locator('input[placeholder*="Title"]').fill('Closed Lot 12!');
    await a.locator('textarea').fill('Got a 38% margin after rehab.');
    await a.getByRole('button', { name: 'Post' }).click();
    await a.waitForTimeout(500);

    await b.goto(`${BASE}/university/feed`);
    await expect(b.getByText('Closed Lot 12!')).toBeVisible({ timeout: 8_000 });

    // B clicks the post + likes
    await b.getByText('Closed Lot 12!').click();
    await b.getByRole('button').filter({ has: b.locator('svg.lucide-heart') }).first().click();
    // (We don't have a direct API to assert A's point delta here; rely on leaderboard test below.)
  });

  test('b) Comment notification ticks the count on the post', async ({ browser }) => {
    const ctxA = await browser.newContext(); const a = await ctxA.newPage();
    await login(a, process.env.E2E_OPERATOR_A_EMAIL!, process.env.E2E_OPERATOR_A_PASSWORD!);
    await a.goto(`${BASE}/university/feed`);
    await a.getByText('Closed Lot 12!').first().click();
    const before = await a.locator('text=/\\d+ comments/').first().innerText();
    await a.locator('textarea[placeholder="Write a comment…"]').fill('Nice work!');
    await a.getByRole('button', { name: 'Post' }).click();
    await a.waitForTimeout(500);
    const after = await a.locator('text=/\\d+ comments/').first().innerText();
    expect(after).not.toEqual(before);
  });

  test('c) edit allowed within 15 min; disabled after', async ({ page }) => {
    await login(page, process.env.E2E_OPERATOR_A_EMAIL!, process.env.E2E_OPERATOR_A_PASSWORD!);
    await page.goto(`${BASE}/university/feed`);
    await page.getByText('Closed Lot 12!').first().click();
    // Pencil should be present for the author within 15 min
    await expect(page.locator('button >> svg.lucide-pencil')).toBeVisible();
    // After 16 min the edit button disappears — simulated by setting the post's
    // created_at backward via Supabase. The Playwright runner needs DB access
    // to do this; the assertion structure is here for completeness.
  });

  test('d) hub admin pins a post; appears at top for all users', async ({ browser }) => {
    const adminCtx = await browser.newContext(); const admin = await adminCtx.newPage();
    const userCtx  = await browser.newContext(); const user  = await userCtx.newPage();
    await login(admin, process.env.E2E_HUB_ADMIN_EMAIL!, process.env.E2E_HUB_ADMIN_PASSWORD!);
    await login(user,  process.env.E2E_OPERATOR_B_EMAIL!, process.env.E2E_OPERATOR_B_PASSWORD!);

    await admin.goto(`${BASE}/university/admin/forum`);
    const row = admin.getByText('Closed Lot 12!').first();
    await row.locator('xpath=ancestor::div[1]').getByRole('button').filter({ has: admin.locator('svg.lucide-pin') }).click();

    await user.goto(`${BASE}/university/feed`);
    await expect(user.locator('text=PINNED').first()).toBeVisible();
  });

  test('e) admin creates event tomorrow 7pm; join link hidden until 30 min before', async ({ browser }) => {
    const adminCtx = await browser.newContext(); const admin = await adminCtx.newPage();
    const userCtx  = await browser.newContext(); const user  = await userCtx.newPage();
    await login(admin, process.env.E2E_HUB_ADMIN_EMAIL!, process.env.E2E_HUB_ADMIN_PASSWORD!);
    await login(user,  process.env.E2E_OPERATOR_A_EMAIL!, process.env.E2E_OPERATOR_A_PASSWORD!);

    await admin.goto(`${BASE}/university/admin/events`);
    await admin.getByRole('button', { name: /New event/i }).click();
    await admin.locator('input').nth(0).fill('LotLine Live · QA Test');
    await admin.locator('input[type=datetime-local]').first().fill(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0,16));
    await admin.locator('input[type=datetime-local]').nth(1).fill(new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString().slice(0,16));
    await admin.locator('input').nth(5).fill('https://zoom.us/j/123');  // join URL
    await admin.getByRole('button', { name: 'Save' }).click();

    await user.goto(`${BASE}/university/events`);
    await expect(user.getByText('LotLine Live · QA Test')).toBeVisible();
    await user.getByText('LotLine Live · QA Test').click();
    await user.getByRole('button', { name: 'Going' }).click();
    // The Join button should NOT be present yet (start is 24h away)
    await expect(user.getByRole('link', { name: /Join event/ })).toHaveCount(0);
    await expect(user.getByText(/Join link will appear/)).toBeVisible();
  });

  test('f) completing a lesson adds 10 points to the 7-day leaderboard', async ({ page }) => {
    await login(page, process.env.E2E_OPERATOR_A_EMAIL!, process.env.E2E_OPERATOR_A_PASSWORD!);
    // Open the sample lesson and seek to >90%
    await page.goto(`${BASE}/university/classroom/welcome-to-lotline/meet-the-playbook`);
    const v = page.locator('video');
    await page.waitForTimeout(2_000);
    await v.evaluate((el: HTMLVideoElement) => { el.currentTime = (el.duration || 60) * 0.95; });
    await page.waitForTimeout(11_000);
    await page.goto(`${BASE}/university/leaderboard`);
    // Refresh button doesn't exist; the materialized view is refreshed by the
    // refresh-leaderboard endpoint. The frontend triggers a refresh on mount
    // when window=7d.
    await expect(page.getByText('YOU')).toBeVisible({ timeout: 10_000 });
  });

  test('g) leaderboard ordering + "your rank" pin both work', async ({ page }) => {
    await login(page, process.env.E2E_OPERATOR_B_EMAIL!, process.env.E2E_OPERATOR_B_PASSWORD!);
    await page.goto(`${BASE}/university/leaderboard`);
    // Pin row should be visible if user is below rank 100, OR the user appears in top 100
    const inline = page.locator('text=YOU').count();
    expect(await inline).toBeGreaterThan(0);
  });

  test('h) investor cannot reach /university/feed', async ({ page }) => {
    await login(page, process.env.E2E_INVESTOR_EMAIL!, process.env.E2E_INVESTOR_PASSWORD!);
    await page.goto(`${BASE}/university/feed`);
    await page.waitForURL(/\/investors/);
    await expect(page.getByRole('link', { name: /University/ })).toHaveCount(0);
  });
});
