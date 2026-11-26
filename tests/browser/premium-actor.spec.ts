import { expect, test, type Page } from '@playwright/test';

const a = { id: '00000000-0000-4000-8000-000000000801', email: 'a@example.test', displayName: 'Beheerder A' };
const b = { id: '00000000-0000-4000-8000-000000000802', email: 'b@example.test', displayName: 'Beheerder B' };
const lifecycle = { state: 'active', termsVersion: '2026-11-23.1', privacyVersion: '2026-11-24', acceptedTermsVersion: '2026-11-23.1', shownPrivacyVersion: '2026-11-23.1', consents: [] };
const file = { name: 'synthetic-private-story.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ redactional: 'Synthetic private story content' })) };
async function session(page: Page) { const state = { parent: a }; await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent: state.parent, admin: true, lifecycle } })); return state; }

test('premium publication sends the captured actor and clears the selected file after confirmed success', async ({ page }) => {
  await session(page); let body: Record<string, unknown> | null = null; let actor = '';
  await page.route('**/api/admin/content/premium', route => { body = route.request().postDataJSON(); actor = route.request().headers()['x-fabelpad-parent']; return route.fulfill({ json: { contentVersion: '1234567890abcdef', audio: { state: 'waiting', reason: 'key_required' } } }); });
  await page.goto('/studio/premium'); await page.getByLabel('Verhaalcode', { exact: true }).fill('synthetic-premium-story'); await page.getByLabel('Verhaalbestand (JSON)', { exact: true }).setInputFiles(file);
  await expect(page.getByText('Bestand ingelezen.', { exact: false })).toBeVisible(); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Verhaal publiceren', exact: true }).click();
  await expect(page.getByText('Verhaal gepubliceerd. Versie 1234567890abcdef.', { exact: false })).toBeVisible(); expect(actor).toBe(a.id); expect(body).toMatchObject({ storyId: 'synthetic-premium-story', payload: { redactional: 'Synthetic private story content' }, confirmPrivate: true }); await expect(page.getByLabel('Verhaalbestand (JSON)', { exact: true })).toHaveValue('');
});
test('a late file read cannot restore private import state after an administrator switch', async ({ page }) => {
  const identity = await session(page); let writes = 0;
  await page.addInitScript(() => { const original = File.prototype.text; Object.defineProperty(File.prototype, 'text', { configurable: true, value: function(this: File) { const file = this; return new Promise<string>(resolve => { Object.defineProperty(window, '__releasePremiumFile', { configurable: true, value: async () => resolve(await original.call(file)) }); }); } }); });
  await page.route('**/api/admin/content/premium', route => { writes++; return route.fulfill({ json: {} }); });
  await page.goto('/studio/premium'); await page.getByLabel('Verhaalcode', { exact: true }).fill('a-private-unpublished-story'); await page.getByLabel('Verhaalbestand (JSON)', { exact: true }).setInputFiles(file);
  await expect.poll(() => page.evaluate(() => typeof (window as unknown as { __releasePremiumFile?: () => void }).__releasePremiumFile === 'function')).toBe(true);
  identity.parent = b; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.getByRole('link', { name: 'Inloggen als beheerder', exact: true })).toBeVisible();
  await page.evaluate(() => (window as unknown as { __releasePremiumFile: () => void }).__releasePremiumFile()); await expect(page.getByLabel('Verhaalcode', { exact: true })).toHaveCount(0); await expect(page.getByText('Bestand ingelezen.', { exact: false })).toHaveCount(0); expect(writes).toBe(0);
});
test('a late publication result cannot restore a cleared import after an administrator switch', async ({ page }) => {
  const identity = await session(page); let release: (() => void) | null = null;
  await page.route('**/api/admin/content/premium', async route => { expect(route.request().headers()['x-fabelpad-parent']).toBe(a.id); await new Promise<void>(resolve => { release = resolve; }); return route.fulfill({ json: { contentVersion: 'abcdef1234567890' } }); });
  await page.goto('/studio/premium'); await page.getByLabel('Verhaalcode', { exact: true }).fill('a-private-unpublished-story'); await page.getByLabel('Verhaalbestand (JSON)', { exact: true }).setInputFiles(file); await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Verhaal publiceren', exact: true }).click(); await expect.poll(() => !!release).toBe(true);
  identity.parent = b; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.getByRole('link', { name: 'Inloggen als beheerder', exact: true })).toBeVisible(); release!(); await page.waitForTimeout(100); await expect(page.getByText('Verhaal gepubliceerd.', { exact: false })).toHaveCount(0); await expect(page.getByLabel('Verhaalbestand (JSON)', { exact: true })).toHaveCount(0);
});
