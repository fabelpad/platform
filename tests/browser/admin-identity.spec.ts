import { expect, test, type Page } from '@playwright/test';

const a = { id: '00000000-0000-4000-8000-000000000701', email: 'a@example.test', displayName: 'Beheerder A' };
const b = { id: '00000000-0000-4000-8000-000000000702', email: 'b@example.test', displayName: 'Beheerder B' };
const lifecycle = { state: 'active', termsVersion: '2026-11-23.1', privacyVersion: '2026-11-23.1', acceptedTermsVersion: '2026-11-23.1', shownPrivacyVersion: '2026-11-23.1', lastActivityAt: '2026-11-23T12:00:00Z', deletionDeadline: null, consents: [] };
const draft = { metadata: { title: 'Concept van A', description: 'Een stationsavontuur.', image: '/art/station.webp' }, chapters: {}, updatedAt: '2026-11-23T12:00:00Z' };
const settings = { fromName: 'Afzender A', fromEmail: 'noreply@example.test', replyTo: 'support@example.test', supportEmail: 'support@example.test', footerText: 'Een servicebericht van Fabelpad.', templates: {} };
const email = { environment: 'staging', appOrigin: 'https://staging.example.test', configured: true, source: 'vault', revision: 3, keyConfigured: true, settings, lastTestAt: null, auth: { emailEnabled: true, googleEnabled: false } };
async function session(page: Page) {
  const state = { parent: a, admin: true, reads: 0 };
  await page.route('**/api/auth/session', route => { state.reads++; return route.fulfill({ json: { configured: true, parent: state.parent, admin: state.admin, lifecycle } }); });
  return state;
}
async function emailReads(page: Page) {
  await page.route('**/api/admin/email', route => route.fulfill({ json: email }));
  await page.route('**/api/admin/email/domain', route => route.fulfill({ json: { status: 'restricted', domain: 'example.test', records: [], tracking: { open: null, click: null } } }));
  await page.route('**/api/admin/email/preview', route => route.fulfill({ json: { html: '<h1>Fictief voorbeeld</h1>', subject: 'Voorbeeld' } }));
}

test('an A to B admin switch clears the open editor and leaves only A-owned recovery', async ({ page }) => {
  const identity = await session(page); let writes = 0;
  await page.route('**/api/content/drafts/station', route => { expect(route.request().headers()['x-fabelpad-parent']).toBe(a.id); if (route.request().method() === 'PUT') writes++; return route.fulfill({ json: { revision: 3, draft } }); });
  await page.goto('/studio'); await page.getByLabel('Verhaaltitel', { exact: true }).fill('Privé hersteltekst A');
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect.poll(() => identity.reads).toBeGreaterThan(1);
  await expect(page.getByLabel('Verhaaltitel', { exact: true })).toHaveValue('Privé hersteltekst A');
  identity.parent = b; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('link', { name: 'Inloggen als beheerder', exact: true })).toBeVisible(); await expect(page.getByLabel('Verhaaltitel', { exact: true })).toHaveCount(0);
  const recovery = await page.evaluate(({ a, b }) => ({ a: localStorage.getItem(`fabelpad-studio-recovery-v1:${encodeURIComponent(a)}:station`), b: localStorage.getItem(`fabelpad-studio-recovery-v1:${encodeURIComponent(b)}:station`) }), { a: a.id, b: b.id });
  expect(recovery.a).toContain('Privé hersteltekst A'); expect(recovery.b).toBeNull(); expect(writes).toBe(0);
});

test('a late Studio save cannot clear A recovery or restore the editor after an admin switch', async ({ page }) => {
  const identity = await session(page); let release: (() => void) | undefined;
  await page.route('**/api/content/drafts/station', async route => {
    expect(route.request().headers()['x-fabelpad-parent']).toBe(a.id);
    if (route.request().method() === 'PUT') { await new Promise<void>(resolve => { release = resolve; }); return route.fulfill({ json: { revision: 4 } }); }
    return route.fulfill({ json: { revision: 3, draft } });
  });
  await page.goto('/studio'); await page.getByLabel('Verhaaltitel', { exact: true }).fill('Herstel vóór sessiewissel'); await page.getByRole('button', { name: 'Concept bewaren', exact: true }).click();
  await expect.poll(() => !!release).toBeTruthy(); identity.parent = b; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('link', { name: 'Inloggen als beheerder', exact: true })).toBeVisible();
  const response = page.waitForResponse(value => value.url().endsWith('/api/content/drafts/station') && value.request().method() === 'PUT'); release!(); await response;
  await expect(page.getByLabel('Verhaaltitel', { exact: true })).toHaveCount(0); await expect(page.getByText('Concept op de server bewaard.', { exact: false })).toHaveCount(0);
  expect(await page.evaluate(id => localStorage.getItem(`fabelpad-studio-recovery-v1:${encodeURIComponent(id)}:station`), a.id)).toContain('Herstel vóór sessiewissel');
});

test('email secrets and edited settings disappear on A to B switch without sending a provider action', async ({ page }) => {
  const identity = await session(page); await emailReads(page); let mutations = 0;
  await page.route('**/api/admin/email/test', route => { mutations++; return route.fulfill({ json: { accepted: true } }); });
  await page.goto('/studio/email'); await page.getByLabel('Resend API-key').fill('re_synthetic_private_candidate_A'); await page.getByLabel('Naam afzender', { exact: true }).fill('Nog niet bewaard A');
  identity.parent = b; await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('link', { name: 'Opnieuw inloggen als beheerder →', exact: true })).toBeVisible();
  await expect(page.getByLabel('Resend API-key')).toHaveCount(0); await expect(page.getByLabel('Naam afzender', { exact: true })).toHaveCount(0); await expect(page.locator('iframe')).toHaveCount(0); expect(mutations).toBe(0);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('re_synthetic_private_candidate_A');
});

test('late email configuration cannot reappear after session invalidation', async ({ page }) => {
  const identity = await session(page); let release: (() => void) | undefined;
  await page.route('**/api/admin/email', async route => { expect(route.request().headers()['x-fabelpad-parent']).toBe(a.id); await new Promise<void>(resolve => { release = resolve; }); return route.fulfill({ json: email }); });
  await page.route('**/api/admin/email/domain', route => route.fulfill({ json: { status: 'restricted', domain: 'example.test', records: [], tracking: { open: null, click: null } } }));
  await page.goto('/studio/email'); await expect.poll(() => !!release).toBeTruthy(); identity.parent = b; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('link', { name: 'Opnieuw inloggen als beheerder →', exact: true })).toBeVisible();
  const response = page.waitForResponse(value => value.url().endsWith('/api/admin/email')); release!(); await response;
  await expect(page.getByLabel('Resend API-key')).toHaveCount(0); await expect(page.locator('.email-environment')).toHaveCount(0); await expect(page.getByText('Afzender A', { exact: true })).toHaveCount(0);
});

test('email test requests carry the original actor and their late success stays hidden after a switch', async ({ page }) => {
  const identity = await session(page); await emailReads(page); let release: (() => void) | undefined;
  await page.route('**/api/admin/email/test', async route => { expect(route.request().headers()['x-fabelpad-parent']).toBe(a.id); await new Promise<void>(resolve => { release = resolve; }); return route.fulfill({ json: { accepted: true, acceptedAt: '2026-11-23T12:00:00Z' } }); });
  await page.goto('/studio/email'); await page.getByLabel('Open- en kliktracking staan uit in Resend').check(); await page.getByRole('button', { name: 'Testmail opnieuw versturen', exact: true }).click();
  await expect.poll(() => !!release).toBeTruthy(); identity.parent = b; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('link', { name: 'Opnieuw inloggen als beheerder →', exact: true })).toBeVisible();
  const response = page.waitForResponse(value => value.url().endsWith('/api/admin/email/test')); release!(); await response;
  await expect(page.getByText('Resend heeft de testmail geaccepteerd', { exact: false })).toHaveCount(0); await expect(page.getByLabel('Resend API-key')).toHaveCount(0);
});
