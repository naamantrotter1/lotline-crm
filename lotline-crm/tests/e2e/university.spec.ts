// Playwright end-to-end tests for the University feature.
//
// Status: skeleton — NOT EXECUTED in this delivery. Requires:
//   - Playwright installed (npm i -D @playwright/test) and configured.
//   - Real Cloudflare Stream credentials set in the runner environment.
//   - Three fixture accounts seeded:
//       hubAdmin       — member of LotLine (is_university_publisher=true, role=owner)
//       operatorA      — member of any non-hub org, account_type=operator
//       operatorB      — member of a different non-hub org
//       investor       — profile.account_type='investor'
//   - Their credentials in env vars (see .env.test.example).
//
// Run with:  npx playwright test tests/e2e/university.spec.ts
import { test, expect, Page } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]',    email);
  await page.fill('input[type=password]', password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/dashboard|\/investors|\/university/);
}

test.describe('University Phase 1', () => {

  test('a) hub admin creates a course and publishes it', async ({ page }) => {
    await login(page, process.env.E2E_HUB_ADMIN_EMAIL!, process.env.E2E_HUB_ADMIN_PASSWORD!);
    await page.goto(`${BASE}/university/admin`);
    await expect(page.getByText('Publisher tools')).toBeVisible();

    page.once('dialog', dialog => dialog.accept('Test Course'));
    await page.getByRole('button', { name: /New course/i }).click();
    await page.waitForURL(/\/university\/admin\/courses\//);

    // Add a section
    page.once('dialog', dialog => dialog.accept('Section 1'));
    await page.getByRole('button', { name: /Add section/i }).click();

    // Add a lesson
    page.once('dialog', dialog => dialog.accept('Lesson 1'));
    await page.getByRole('button', { name: /Add lesson/i }).click();

    // Upload a tiny video — requires a real CF token in env.
    // Skipped here; in CI, plug in a 5-second mp4 fixture.
    // const fileInput = page.locator('input[type=file]');
    // await fileInput.setInputFiles('tests/fixtures/sample.mp4');
    // await page.waitForSelector('text=/cf_stream ·/');

    // Publish
    await page.locator('select').first().selectOption('published');
    await page.getByRole('button', { name: 'Save' }).click();
  });

  test('b) operator opens the published course and plays a lesson', async ({ page }) => {
    await login(page, process.env.E2E_OPERATOR_A_EMAIL!, process.env.E2E_OPERATOR_A_PASSWORD!);
    await page.goto(`${BASE}/university`);
    await expect(page.getByText(/Welcome to LotLine/i)).toBeVisible();
    await page.getByText(/Welcome to LotLine/i).click();
    await page.waitForURL(/\/university\/welcome-to-lotline$/);
    await page.getByRole('button', { name: /Start/i }).click();
    await page.waitForURL(/\/university\/welcome-to-lotline\/.+/);
    await expect(page.locator('video')).toBeVisible();
  });

  test('c) progress is reported, then resumed', async ({ page }) => {
    await login(page, process.env.E2E_OPERATOR_A_EMAIL!, process.env.E2E_OPERATOR_A_PASSWORD!);
    await page.goto(`${BASE}/university/welcome-to-lotline/meet-the-playbook`);
    const video = page.locator('video');
    await video.evaluate((v: HTMLVideoElement) => v.play());
    await page.waitForTimeout(12_000); // allow at least one progress beacon

    // Leave at ~50%
    await video.evaluate((v: HTMLVideoElement) => { v.currentTime = (v.duration || 60) * 0.5; });
    await page.waitForTimeout(2_000);

    // Reload — player should resume near 50%
    await page.reload();
    await page.waitForTimeout(3_000);
    const t = await video.evaluate((v: HTMLVideoElement) => v.currentTime);
    expect(t).toBeGreaterThan(5);
  });

  test('d) operator from a different org also sees the course', async ({ page }) => {
    await login(page, process.env.E2E_OPERATOR_B_EMAIL!, process.env.E2E_OPERATOR_B_PASSWORD!);
    await page.goto(`${BASE}/university`);
    await expect(page.getByText(/Welcome to LotLine/i)).toBeVisible();
  });

  test('e) investor is blocked from /university', async ({ page }) => {
    await login(page, process.env.E2E_INVESTOR_EMAIL!, process.env.E2E_INVESTOR_PASSWORD!);
    await page.goto(`${BASE}/university`);
    await page.waitForURL(/\/investors/);
    // Sidebar item also hidden
    await expect(page.getByRole('link', { name: /University/i })).toHaveCount(0);
  });

  test('f) lesson auto-completes at 90% watched', async ({ page }) => {
    await login(page, process.env.E2E_OPERATOR_A_EMAIL!, process.env.E2E_OPERATOR_A_PASSWORD!);
    await page.goto(`${BASE}/university/welcome-to-lotline/meet-the-playbook`);
    const video = page.locator('video');
    await page.waitForTimeout(2_000);
    await video.evaluate((v: HTMLVideoElement) => { v.currentTime = (v.duration || 60) * 0.95; });
    await page.waitForTimeout(11_000); // throttle flushes after 10s
    await expect(page.getByText(/^Completed$/)).toBeVisible({ timeout: 5_000 });
  });
});
