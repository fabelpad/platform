import { test, expect, type Page } from '@playwright/test';
import type { PrivacyCase } from '../../lib/privacyAdmin';

const admin = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.test', displayName: 'Testbeheerder' };
const subject = '22222222-2222-4222-8222-222222222222';
const caseId = '33333333-3333-4333-8333-333333333333';
const lifecycle = { state: 'active', termsVersion: '2026-11-22', privacyVersion: '2026-11-22.1', acceptedTermsVersion: '2026-11-22', shownPrivacyVersion: '2026-11-22.1', lastActivityAt: '2026-11-22T12:00:00Z', deletionDeadline: null, consents: [] };
function mockSession(page: Page, allowed = true) {
  return page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent: admin, admin: allowed, lifecycle } }));
}
const fixture = (extra: Partial<PrivacyCase> = {}): PrivacyCase => ({ id: caseId, reference: 'AVG_TEST_0001', receivedAt: '2026-11-22T12:00:00Z', responseDueAt: '2026-12-22T12:00:00Z', kind: 'erasure', scope: 'child', parentId: null, profileId: null, verification: 'pending', state: 'received', verificationMethod: null, firstResponseAt: null, completedAt: null, extendedDueAt: null, extensionReason: null, ...extra });

test('privacy support metadata is never requested for a non-administrator', async ({ page }) => {
  await mockSession(page, false);
  let reads = 0;
  await page.route('**/api/admin/privacy**', route => { reads++; return route.fulfill({ json: { cases: [], total: 0, truncated: false, nextOffset: null } }); });
  await page.goto('/studio/privacy');
  await expect(page.getByText('Dit account heeft geen toegang tot de privacyverzoeken. Rond zo nodig eerst je ouderaccount af.')).toBeVisible();
  await expect(page.getByLabel('Dossierkenmerk')).toHaveCount(0);
  expect(reads).toBe(0);
});

test('an administrator registers a minimal child request and explicitly verifies before scoped erasure', async ({ page }) => {
  await mockSession(page);
  let current: ReturnType<typeof fixture> | null = null;
  const writes: { path: string; body: Record<string, unknown>; actor: string | undefined }[] = [];
  await page.route('**/api/admin/privacy**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') return route.fulfill({ json: { cases: current ? [current] : [], total: current ? 1 : 0, truncated: false, nextOffset: null } });
    const body = request.postDataJSON(); writes.push({ path: url.pathname, body, actor: request.headers()['x-fabelpad-parent'] });
    if (request.method() === 'POST') { current = fixture({ reference: body.reference, kind: body.kind, scope: body.scope }); return route.fulfill({ json: { id: caseId, state: 'received', receivedAt: current.receivedAt, responseDueAt: current.responseDueAt } }); }
    if (body.action === 'bind_subject') current = { ...current!, parentId: body.parentId, profileId: body.profileId };
    if (body.action === 'verify') current = { ...current!, state: 'verified', verification: 'verified', verificationMethod: body.verificationMethod };
    if (body.action === 'execute_erasure') current = { ...current!, state: 'completed', completedAt: '2026-11-22T12:05:00Z' };
    return route.fulfill({ json: { id: caseId, state: current!.state } });
  });
  await page.goto('/studio/privacy');
  await page.getByLabel('Dossierkenmerk', { exact: true }).fill('AVG_CHILD_0001');
  await page.getByRole('combobox', { name: 'Soort verzoek', exact: true }).selectOption('erasure');
  await page.getByRole('combobox', { name: 'Bereik', exact: true }).selectOption('child');
  await page.getByRole('button', { name: 'Registreer ontvangst', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AVG_CHILD_0001', exact: true })).toBeVisible();
  expect(writes[0].body).toEqual({ reference: 'AVG_CHILD_0001', kind: 'erasure', scope: 'child', parentId: null, profileId: null });
  expect(writes[0].actor).toBe(admin.id);
  await expect(page.getByRole('button', { name: 'Verificatie vastleggen', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Gegevenswissing uitvoeren', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Betrokkene veilig koppelen', exact: true }).click();
  await page.getByLabel('Te koppelen ouderaccountnummer', { exact: true }).fill(subject);
  await page.getByLabel('Te koppelen profielnummer', { exact: true }).fill('synthetic-child');
  await page.getByLabel('Ik heb de juiste aanvrager, het bereik en de vereiste afhandeling gecontroleerd en bevestig deze handeling.').check();
  await page.getByRole('button', { name: 'Bevestig zaakhandeling', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Verificatie vastleggen', exact: true })).toBeEnabled();
  expect(writes.at(-1)?.body).toEqual({ action: 'bind_subject', parentId: subject, profileId: 'synthetic-child' });
  await page.getByRole('button', { name: 'Verificatie vastleggen', exact: true }).click();
  await page.getByRole('combobox', { name: 'Verificatiemethode', exact: true }).selectOption('proportionate_support');
  await page.getByLabel('Ik heb de juiste aanvrager, het bereik en de vereiste afhandeling gecontroleerd en bevestig deze handeling.').check();
  await page.getByRole('button', { name: 'Bevestig zaakhandeling', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gegevenswissing uitvoeren', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Afhandeling vastleggen', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Gegevenswissing uitvoeren', exact: true }).click();
  await expect(page.getByText('Dit wist uitsluitend het genoemde kinderprofiel en de leesgegevens daarvan.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Bevestig zaakhandeling', exact: true })).toBeDisabled();
  await page.getByLabel('Ik heb de juiste aanvrager, het bereik en de vereiste afhandeling gecontroleerd en bevestig deze handeling.').check();
  await page.getByRole('button', { name: 'Bevestig zaakhandeling', exact: true }).click();
  await expect(page.locator('.privacy-admin-case')).toContainText('Afgerond');
  expect(writes.at(-1)?.body).toEqual({ action: 'execute_erasure' });
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('AVG_CHILD_0001');
});

test('case pagination is explicit and an expired admin session clears the displayed metadata', async ({ page }) => {
  await mockSession(page);
  let expired = false;
  const offsets: number[] = [];
  await page.route('**/api/admin/privacy**', route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset') || 0); offsets.push(offset);
    if (expired) return route.fulfill({ status: 401, json: { error: 'not_authenticated' } });
    return route.fulfill({ json: { cases: [fixture({ reference: offset ? 'AVG_PAGE_0101' : 'AVG_PAGE_0001', parentId: subject })], total: 101, truncated: offset === 0, nextOffset: offset ? null : 100 } });
  });
  await page.goto('/studio/privacy');
  await page.getByRole('button', { name: 'Volgende pagina', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'AVG_PAGE_0101', exact: true })).toBeVisible();
  expect(offsets).toEqual([0, 100]);
  expired = true;
  await page.getByRole('button', { name: 'Overzicht vernieuwen', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Inloggen als beheerder', exact: true })).toHaveAttribute('href', '/inloggen?next=%2Fstudio%2Fprivacy');
  await expect(page.locator('body')).not.toContainText('AVG_PAGE_0101');
  await expect(page.locator('body')).not.toContainText(subject);
});
