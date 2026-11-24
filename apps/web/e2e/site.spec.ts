import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

const PASSWORD = 'correct-horse-9';
async function signIn(page: Page, email: string) {
  await page.goto('/en/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('main').getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL(/\/(account|staff)/);
}
async function clean(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${where}: ${v.id} ${v.nodes[0].target}`)).toEqual([]);
}
test.beforeEach(({ page }) => {
  page.on('pageerror', (e) => { throw new Error(`Page error: ${e.message}`); });
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|hydrat/i.test(m.text())) throw new Error(m.text()); });
});

test('public pages are real HTML, accessible, and fit a phone', async ({ page, request }) => {
  const html = await (await request.get('/en')).text();
  expect(html).toContain('Every child in school');
  expect(html).toContain('School kits');
  for (const p of ['', '/campaigns', '/campaigns/school-kits', '/donate', '/events', '/events/tree-day', '/courses', '/library', '/volunteer', '/blog', '/contact', '/about', '/privacy', '/terms', '/refunds', '/login', '/register', '/register-ngo', '/forgot-password']) {
    const res = await page.goto(`/en${p}`);
    expect(res!.status(), p).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    expect(await page.locator('body').innerText(), p).not.toMatch(/\b(common|nav|home|auth|donate)\.[a-z]+[A-Z]?\w*\b/);
    await clean(page, p || '/');
    await page.setViewportSize({ width: 360, height: 740 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `${p} overflows`).toBeLessThanOrEqual(360);
    await page.setViewportSize({ width: 1280, height: 800 });
  }
  expect((await page.goto('/en/no-such-page'))!.status()).toBe(404);
});
test('dark mode is readable', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  for (const p of ['', '/donate', '/login']) { await page.goto(`/en${p}`); await clean(page, `dark ${p}`); }
});
test('languages: Hindi text, Urdu right-to-left', async ({ page }) => {
  await page.goto('/hi/donate');
  await expect(page.locator('html')).toHaveAttribute('lang', 'hi');
  expect(await page.locator('h1').innerText()).toMatch(/[ऀ-ॿ]/);
  await page.goto('/ur');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.goto('/en/campaigns');
  await page.getByLabel('Language').selectOption('hi');
  await expect(page).toHaveURL(/\/hi\/campaigns/);
});
test('security headers, no header echo, sanitised content', async ({ page, request }) => {
  const r = await request.get('/', { maxRedirects: 0, headers: { authorization: 'Bearer secret', cookie: 'a=b' } });
  expect(r.status()).toBe(307);
  expect(r.headers()['authorization']).toBeUndefined();
  expect(r.headers()['cookie']).toBeUndefined();
  const h = (await request.get('/en')).headers();
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy']).not.toMatch(/script-src[^;]*unsafe-inline/);
  await page.goto('/en/campaigns/school-kits');
  expect(await page.evaluate(() => (window as any).__xss)).toBeUndefined();
  for (const p of ['/robots.txt', '/sitemap.xml', '/manifest.webmanifest', '/icon.svg']) expect((await request.get(p)).status(), p).toBe(200);
});
test('a visitor donates with an 80G receipt', async ({ page }) => {
  await page.goto('/en/campaigns/school-kits');
  await page.getByLabel('Other amount').fill('1501');
  await page.getByLabel('Full name').fill('Asha Rao');
  await page.getByLabel('Email').first().fill('asha@example.org');
  await page.getByLabel('I want an 80G tax receipt').check();
  await page.getByLabel('PAN').fill('bad');
  await page.getByLabel('Address for the receipt').fill('1 MG Road, Bengaluru');
  await page.getByRole('button', { name: /Pay/ }).click();
  await expect(page.getByText('Enter a valid PAN')).toBeVisible();
  await page.getByLabel('PAN').fill('ABCDE1234F');
  await page.getByRole('button', { name: /Pay ₹1,501/ }).click();
  await expect(page.getByText(/Receipt 80G\//)).toBeVisible();
  await page.goto('/en/campaigns/school-kits');
  await expect(page.getByText('₹1,501 raised')).toBeVisible();
});
test('monthly giving can be started and stopped', async ({ page }) => {
  await signIn(page, 'donor@example.org');
  await page.goto('/en/donate');
  await page.getByText('Monthly', { exact: true }).click();
  await expect(page.getByLabel('Full name')).toHaveValue('donor Test');
  await page.getByRole('button', { name: /Start giving/ }).click();
  await expect(page.getByText(/recurring donation is set up/)).toBeVisible();
  await page.goto('/en/account/giving');
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Stop' }).click();
  await expect(page.getByText('Recurring donations')).toHaveCount(0);
});
test('sign in, protected pages, and sign out', async ({ page }) => {
  await page.goto('/en/staff');
  await expect(page).toHaveURL(/login/);
  await signIn(page, 'donor@example.org');
  await page.goto('/en/staff');
  await expect(page.getByText('no staff access')).toBeVisible();
  for (const p of ['giving', 'volunteering', 'support', 'learning', 'notifications', 'profile', 'security', 'privacy']) { await page.goto(`/en/account/${p}`); await expect(page.getByRole('heading', { level: 1 })).toBeVisible(); await page.waitForLoadState('networkidle'); await clean(page, p); }
  await page.getByRole('button', { name: 'Sign out' }).first().click();
  await page.goto('/en/account');
  await expect(page).toHaveURL(/login/);
});
test('a session survives when the short cookie expires', async ({ page, context }) => {
  await signIn(page, 'donor@example.org');
  await context.clearCookies({ name: 'vf_at' });
  await page.goto('/en/account/profile');
  await expect(page.getByLabel('First name')).toHaveValue('donor');
});
test('staff can open every screen and manage a campaign', async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, 'admin@example.org');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  const hrefs = await page.locator('nav[aria-label="Staff"] a[href*="/staff/"]').evaluateAll((a) => a.map((x) => (x as HTMLAnchorElement).getAttribute('href')!));
  expect(hrefs.length).toBeGreaterThan(40);
  for (const h of hrefs) {
    await page.goto(h);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main h1'), h).toHaveCount(1);
    await expect(page.locator('main .notice-error'), h).toHaveCount(0);
    await clean(page, h);
  }
  await page.goto('/en/staff/campaigns');
  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByLabel('Title').fill('Clean water');
  await page.getByLabel('Web address').fill('clean-water');
  await page.getByLabel('Goal (rupees)').fill('50,000');
  await page.getByLabel('Status').selectOption('ACTIVE');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: 'Clean water' })).toBeVisible();
  await page.goto('/en/campaigns/clean-water');
  await expect(page.getByText('of ₹50,000')).toBeVisible();
  await page.goto('/en/staff/donations');
  await page.getByRole('button', { name: 'Record offline gift' }).click();
  await page.getByLabel(/^Name/).fill('Cash Giver');
  await page.getByLabel('Amount (rupees)').fill('250');
  await page.getByLabel('Received on').fill('2026-11-01');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: 'Cash Giver' })).toBeVisible();
});
test('field visits are kept offline and sent later', async ({ page, context }) => {
  await signIn(page, 'field@example.org');
  await page.goto('/en/field');
  await page.waitForLoadState('networkidle');
  await context.setOffline(true);
  await page.getByLabel('Purpose').fill('Offline visit');
  await page.getByRole('button', { name: 'Save visit' }).click();
  await expect(page.getByText('1 waiting to send')).toBeVisible({ timeout: 20_000 });
  await context.setOffline(false);
  await expect(page.getByText('waiting to send')).toHaveCount(0, { timeout: 20_000 });
  await page.goto('/en/staff/visits');
  await expect(page.getByRole('cell', { name: 'Offline visit' })).toBeVisible();
});
