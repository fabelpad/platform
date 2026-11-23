import { test, expect, type Page, type Route } from '@playwright/test';
import type { PrivacyCase } from '../../lib/privacyAdmin';

const actorA = { id: '11111111-1111-4111-8111-111111111111', email: 'admin-a@example.test', displayName: 'Beheerder A' };
const actorB = { id: '22222222-2222-4222-8222-222222222222', email: 'admin-b@example.test', displayName: 'Beheerder B' };
const subject = '33333333-3333-4333-8333-333333333333';
const lifecycle = { state: 'active', termsVersion: 'current', privacyVersion: 'current', acceptedTermsVersion: 'current', shownPrivacyVersion: 'current', lastActivityAt: null, deletionDeadline: null, consents: [] };
const sessionA = { configured: true, parent: actorA, admin: true, lifecycle };
const fixture: PrivacyCase = { id: 'case-a', reference: 'AVG_PRIVATE_A_0001', kind: 'access', scope: 'parent', parentId: subject, profileId: null, verification: 'verified', state: 'verified', receivedAt: '2026-11-23T12:00:00Z', responseDueAt: '2026-12-23T12:00:00Z', verificationMethod: 'verified_parent', firstResponseAt: null, completedAt: null, extendedDueAt: null, extensionReason: null };
const list = (item = fixture) => ({ cases: [item], total: 1, truncated: false, nextOffset: null });
async function identity(page: Page) {
  let current: object = sessionA, failed = false, reads = 0;
  await page.route('**/api/auth/session', route => { reads++; return route.fulfill(failed ? { status: 503, json: { message: 'De beheersessie is tijdelijk niet bereikbaar.' } } : { json: current }); });
  return { set(value: object) { current = value; }, fail() { failed = true; }, reads: () => reads };
}
async function foreground(page: Page, kind: 'focus' | 'visibilitychange' = 'focus') {
  await page.evaluate(kind => { if (kind === 'focus') window.dispatchEvent(new Event('focus')); else document.dispatchEvent(new Event('visibilitychange')); }, kind);
}
async function expectCleared(page: Page) {
  await expect(page.getByRole('link', { name: 'Inloggen als beheerder', exact: true })).toHaveAttribute('href', '/inloggen?next=%2Fstudio%2Fprivacy');
  await expect(page.locator('.privacy-admin-case')).toHaveCount(0);
  await expect(page.getByLabel('Dossierkenmerk', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Deze zaakhandeling bevestigen', exact: true })).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(fixture.reference);
  await expect(page.locator('body')).not.toContainText(subject);
}

// Use actual browser HTTP promises; the test releases old responses only after
// the hook has already confirmed that the visible actor is no longer eligible.
test('privacy clears A metadata and unsent fields when focus reveals another administrator, ignoring a late read', async ({ page }) => {
  const auth = await identity(page);
  let reads = 0, pending: Route | undefined;
  const actors: (string | undefined)[] = [];
  await page.route('**/api/admin/privacy**', route => {
    actors.push(route.request().headers()['x-fabelpad-parent']);
    reads++;
    if (reads === 2) { pending = route; return; }
    return route.fulfill({ json: list() });
  });
  await page.goto('/studio/privacy');
  await expect(page.getByRole('heading', { name: fixture.reference, exact: true })).toBeVisible();
  await page.getByLabel('Dossierkenmerk', { exact: true }).fill('AVG_UNSENT_A_0002');
  await page.getByLabel('Technisch ouderaccountnummer (optioneel)', { exact: true }).fill(subject);
  await page.getByRole('button', { name: 'Afhandeling vastleggen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Deze zaakhandeling bevestigen', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Overzicht vernieuwen', exact: true }).click();
  await expect.poll(() => !!pending).toBeTruthy();
  const previousReads = auth.reads(); auth.set({ ...sessionA, parent: actorB }); await foreground(page);
  await expect.poll(auth.reads).toBeGreaterThan(previousReads);
  await expectCleared(page);
  const finished = page.waitForResponse(response => response.url().includes('/api/admin/privacy?offset='));
  await pending!.fulfill({ json: list({ ...fixture, reference: 'AVG_LATE_PRIVATE_A_0003' }) });
  await (await finished).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await expectCleared(page);
  await expect(page.locator('body')).not.toContainText('AVG_LATE_PRIVATE_A_0003');
  expect(actors).toEqual([actorA.id, actorA.id]);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('AVG_');
});

test('privacy drops confirmation and ignores late mutation success after role revocation on visibility', async ({ page }) => {
  const auth = await identity(page);
  let reads = 0, pending: Route | undefined;
  const writes: { actor: string | undefined; body: unknown }[] = [];
  await page.route('**/api/admin/privacy**', route => {
    if (route.request().method() === 'GET') { reads++; return route.fulfill({ json: list() }); }
    writes.push({ actor: route.request().headers()['x-fabelpad-parent'], body: route.request().postDataJSON() }); pending = route;
  });
  await page.goto('/studio/privacy');
  await page.getByRole('button', { name: 'Afhandeling vastleggen', exact: true }).click();
  await page.getByLabel('Ik heb de juiste aanvrager, het bereik en de vereiste afhandeling gecontroleerd en bevestig deze handeling.').check();
  await page.getByRole('button', { name: 'Bevestig zaakhandeling', exact: true }).click();
  await expect.poll(() => !!pending).toBeTruthy();
  auth.set({ ...sessionA, admin: false }); await foreground(page, 'visibilitychange');
  await expectCleared(page);
  const finished = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/api/admin/privacy/'));
  await pending!.fulfill({ json: { id: fixture.id, state: 'completed' } }); await (await finished).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await expectCleared(page);
  await expect(page.locator('body')).not.toContainText('De zaakstatus is bijgewerkt.');
  expect(reads).toBe(1);
  expect(writes).toEqual([{ actor: actorA.id, body: { action: 'complete' } }]);
});

for (const reason of ['logout', 'inactive'] as const) test(`privacy removes loaded technical case data after ${reason}`, async ({ page }) => {
  const auth = await identity(page);
  await page.route('**/api/admin/privacy**', route => route.fulfill({ json: list() }));
  await page.goto('/studio/privacy');
  await expect(page.getByRole('heading', { name: fixture.reference, exact: true })).toBeVisible();
  auth.set(reason === 'logout' ? { configured: true, parent: null, admin: false } : { ...sessionA, lifecycle: { ...lifecycle, state: 'deletion_pending' } });
  await foreground(page); await expectCleared(page);
});

test('privacy fails closed on foreground Auth outage and ignores a late failed read with private text', async ({ page }) => {
  const auth = await identity(page);
  let reads = 0, pending: Route | undefined;
  await page.route('**/api/admin/privacy**', route => { reads++; if (reads > 1) { pending = route; return; } return route.fulfill({ json: list() }); });
  await page.goto('/studio/privacy');
  await expect(page.getByRole('heading', { name: fixture.reference, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Overzicht vernieuwen', exact: true }).click(); await expect.poll(() => !!pending).toBeTruthy();
  auth.fail(); await foreground(page); await expectCleared(page);
  await expect(page.locator('.account-feedback[role=alert]')).toContainText('tijdelijk niet bereikbaar');
  const finished = page.waitForResponse(response => response.url().includes('/api/admin/privacy?offset='));
  await pending!.fulfill({ status: 500, json: { message: 'STALE_PRIVATE_DETAILS_SHOULD_NOT_APPEAR' } }); await (await finished).finished();
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
  await expect(page.locator('body')).not.toContainText('STALE_PRIVATE_DETAILS_SHOULD_NOT_APPEAR');
  await expectCleared(page);
});
