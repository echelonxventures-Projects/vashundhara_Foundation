import AxeBuilder from '@axe-core/playwright';
import { expect, Page, test } from '@playwright/test';

async function signIn(page: Page, email: string) {
  await page.goto('/en/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('correct-horse-9');
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
  page.on('dialog', (d) => void d.accept());
});
const addField = async (page: Page, name: string, kind: string, ticks: string[] = []) => {
  await page.getByRole('button', { name: 'Add field' }).click();
  const box = page.getByRole('dialog');
  await box.getByLabel('Name').fill(name);
  await box.getByLabel('Kind').selectOption({ label: kind });
  for (const t of ticks) await box.getByLabel(t).check();
  return box;
};
const done = (page: Page) => page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
const publish = async (page: Page) => {
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved. Nothing is live')).toBeVisible();
  await page.getByRole('button', { name: 'Publish and history' }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published. It is live now.')).toBeVisible();
};

test('an NGO Administrator cannot change the structure until Super Admin permits it', async ({ page }) => {
  await signIn(page, 'admin@example.org');
  await page.goto('/en/staff');
  await expect(page.getByRole('link', { name: 'Donors' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Structure' })).toHaveCount(0);
  await page.goto('/en/staff/structure');
  await expect(page.getByText('Only Super Admin can change')).toBeVisible();
});

test('build fields, a table, a form and a rule, then use them', async ({ page, browser }) => {
  test.setTimeout(150_000);
  await signIn(page, 'root@example.org');
  await page.goto('/en/staff/structure');
  await expect(page.getByRole('heading', { name: 'Extra fields on Donors' })).toBeVisible();
  await clean(page, 'editor empty');

  const box = await addField(page, 'Blood group', 'Choose one', ['Show in the list', 'Offer as a filter']);
  for (const c of ['A+', 'O-']) { await box.getByRole('button', { name: 'Add choice' }).click(); await box.locator('input[aria-label^="Choice"]').last().fill(c); }
  await clean(page, 'field dialog');
  await done(page);
  await page.getByLabel('Name for Name').fill('Donor name');
  await page.getByLabel('Hide Notes').check();
  await clean(page, 'editor fields');

  await page.getByRole('button', { name: 'Own tables' }).click();
  await page.getByLabel('New table name').fill('Help requests');
  await page.getByRole('button', { name: 'Add table' }).click();
  await page.getByLabel('Menu section').fill('Programmes');
  await addField(page, 'Person', 'Short text', ['Required on new records', 'Include in search']); await done(page);
  await addField(page, 'Amount needed', 'Amount in rupees'); await done(page);
  await addField(page, 'Email', 'Email'); await done(page);
  await addField(page, 'Donor', 'Link to another record');
  await page.getByRole('dialog').getByLabel('Links to').selectOption({ label: 'Donors' });
  await done(page);
  await page.getByLabel('Field Worker: read').check();
  await clean(page, 'editor table');

  await page.getByRole('button', { name: 'Forms', exact: true }).click();
  await page.getByLabel('New form name').fill('Ask for help');
  await page.getByRole('button', { name: 'Add form' }).click();
  await page.getByLabel('Saves into').selectOption({ label: 'Help requests' });
  for (const q of ['Person', 'Amount needed', 'Email']) await page.getByLabel(q, { exact: true }).check();
  await clean(page, 'editor form');

  await page.getByRole('button', { name: 'Rules', exact: true }).click();
  await page.getByLabel('New rule name').fill('Large request');
  await page.getByRole('button', { name: 'Add rule' }).click();
  await page.getByLabel('Watches').selectOption({ label: 'Help requests (own table)' });
  await page.getByRole('button', { name: 'Add condition' }).click();
  await page.getByLabel('Condition 1 field').selectOption({ label: 'Amount needed' });
  await page.getByLabel('Condition 1 test').selectOption({ label: 'is more than' });
  await page.getByLabel('Condition 1 value').fill('1000');
  await page.getByRole('button', { name: 'Add action' }).click();
  await page.getByLabel('Action 1', { exact: true }).selectOption({ label: 'Create a CRM task' });
  await page.getByLabel('Subject').fill('Call {{person}}');
  await clean(page, 'editor rule');
  await publish(page);
  await clean(page, 'editor publish');

  // Staff see it straight away.
  await page.goto('/en/staff/donors');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByLabel('Notes')).toHaveCount(0);
  await page.getByLabel('Donor name').fill('Kiran Rao');
  await page.getByRole('dialog').getByLabel('Blood group').selectOption({ label: 'O-' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: 'O-' })).toBeVisible();
  await page.getByLabel('Blood group').selectOption({ label: 'A+' });
  await expect(page.getByText('Nothing here yet.')).toBeVisible();
  await page.getByLabel('Blood group').selectOption({ label: 'O-' });
  await expect(page.getByRole('cell', { name: 'Kiran Rao' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByRole('dialog').getByLabel('Blood group')).toHaveValue(/.+/);
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('link', { name: 'Help requests' }).click();
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByLabel('Person').fill('Ravi');
  await page.getByLabel('Amount needed').fill('250.50');
  await page.getByLabel('Donor', { exact: true }).selectOption({ label: 'Kiran Rao' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('cell', { name: 'Ravi' })).toBeVisible();
  await expect(page.getByRole('cell', { name: '₹250.50' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Kiran Rao' })).toBeVisible();
  await clean(page, 'own table');

  // A visitor sends the form on a phone.
  const visitor = await (await browser.newContext({ baseURL: 'http://localhost:3101', viewport: { width: 360, height: 740 } })).newPage();
  await visitor.goto('/hi/forms/ask_for_help');
  await expect(visitor.getByRole('heading', { name: 'Ask for help' })).toBeVisible();
  await clean(visitor, 'public form');
  expect(await visitor.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await visitor.goto('/en/forms/ask_for_help');
  await visitor.getByLabel('Person').fill('Mina');
  await visitor.getByLabel('Amount needed').fill('5000');
  await visitor.getByLabel('Email').first().fill('mina@example.org');
  await visitor.getByLabel(/I agree that/).check();
  await visitor.getByRole('button', { name: 'Send' }).click();
  await expect(visitor.getByText('Thank you. We have received it.')).toBeVisible();
  await visitor.close();
  await page.reload();
  await expect(page.getByRole('cell', { name: 'Mina', exact: true })).toBeVisible();
  await expect(async () => { await page.goto('/en/staff/activities'); await expect(page.getByRole('cell', { name: 'Call Mina' })).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 30_000 });

  await page.setViewportSize({ width: 360, height: 740 });
  for (const p of ['structure', 'donors', 't/help_requests', 'receipts']) { await page.goto(`/en/staff/${p}`); await page.locator('h1').waitFor(); await page.waitForTimeout(600); expect(await page.evaluate(() => document.documentElement.scrollWidth), p).toBeLessThanOrEqual(360); }
  await page.setViewportSize({ width: 1280, height: 800 });

  // A change that would lose data is refused; archiving hides without losing.
  await page.goto('/en/staff/structure');
  await page.getByRole('button', { name: 'Edit Blood group' }).click();
  await page.getByRole('dialog').getByLabel('Kind').selectOption({ label: 'Number' });
  await done(page);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved. Nothing is live')).toBeVisible();
  await page.getByRole('button', { name: 'Publish and history' }).click();
  await expect(page.getByText(/1 of 1 values cannot become number/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Discard draft' }).click();
  await expect(page.getByText('Draft discarded')).toBeVisible();
  await page.getByRole('button', { name: 'Fields and layout' }).click();
  await page.getByRole('button', { name: 'Archive Blood group' }).click();
  await publish(page);
  await page.goto('/en/staff/donors');
  await expect(page.getByRole('cell', { name: 'Kiran Rao' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'O-' })).toHaveCount(0);
  await page.goto('/en/staff/structure');
  await page.getByRole('button', { name: 'Publish and history' }).click();
  await page.getByRole('button', { name: 'Copy version 1 to the draft' }).click();
  await expect(page.getByText('Copied to the draft')).toBeVisible();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Published. It is live now.')).toBeVisible();
  await page.goto('/en/staff/donors');
  await expect(page.getByRole('cell', { name: 'O-' })).toBeVisible();
});

test('an NGO Administrator sends for review, and publishes directly only when enabled', async ({ page, browser }) => {
  const root = await (await browser.newContext({ baseURL: 'http://localhost:3101' })).newPage();
  await signIn(root, 'root@example.org');
  // The staff site proxies the same API that the platform console uses.
  const call = (method: string, path: string, body?: unknown) => root.evaluate(async ([m, p, b]) => { const r = await fetch(`/api/${p}`, { method: m as string, headers: { 'x-requested-with': 'vf', 'content-type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: await r.json() }; }, [method, path, body] as const);
  const id = (await call('GET', 'platform/tenants')).body.items[0].id;
  expect((await call('PUT', `platform/structure/ngos/${id}/policy`, { ngoAdminAllowed: true })).status).toBe(200);

  await signIn(page, 'admin@example.org');
  await page.goto('/en/staff/structure');
  await addField(page, 'House name', 'Short text', ['Show in the list']); await done(page);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByText('Draft saved. Nothing is live').waitFor();
  await page.getByRole('button', { name: 'Publish and history' }).click();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toHaveCount(0);
  await page.getByLabel('Note for Super Admin').fill('For the new survey');
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('Sent to Super Admin for review.')).toBeVisible();
  await expect(page.getByText('Waiting for Super Admin')).toBeVisible();
  await clean(page, 'waiting');
  const waiting = (await call('GET', 'platform/structure/reviews')).body.items;
  expect(waiting).toHaveLength(1);
  expect((await call('POST', `platform/structure/ngos/${id}/manage/return`, { rev: waiting[0].rev, note: 'Call it Building name' })).status).toBe(200);
  await page.reload();
  await expect(page.getByText('sent this draft back: Call it Building name')).toBeVisible();
  await clean(page, 'sent back');
  await page.getByRole('button', { name: 'Edit House name' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill('Building name');
  await done(page);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await page.getByText('Draft saved. Nothing is live').waitFor();
  await page.getByRole('button', { name: 'Publish and history' }).click();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('Sent to Super Admin for review.')).toBeVisible();
  const again = (await call('GET', 'platform/structure/reviews')).body.items[0];
  expect((await call('POST', `platform/structure/ngos/${id}/manage/publish`, { rev: again.rev })).status).toBe(200);
  await page.goto('/en/staff/donors');
  await expect(page.getByRole('columnheader', { name: 'Building name' })).toBeVisible();

  await call('PUT', `platform/structure/ngos/${id}/policy`, { ngoAdminPublish: true });
  await page.goto('/en/staff/structure');
  await page.getByRole('button', { name: 'Archive Building name' }).click();
  await publish(page);
  await page.goto('/en/staff/donors');
  await expect(page.getByRole('columnheader', { name: 'Donor name' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Building name' })).toHaveCount(0);
  await call('PUT', `platform/structure/ngos/${id}/policy`, { ngoAdminPublish: false, ngoAdminAllowed: false });
});
