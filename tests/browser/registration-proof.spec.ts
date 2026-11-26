import { test, expect, type Page } from '@playwright/test';
import type { ParentAccountStatus } from '../../lib/parentAccount';
import type { FamilySnapshot } from '../../src/profileStorage';

const parent = { id: '11111111-1111-4111-8111-111111111111', email: 'parent@example.test', displayName: 'Testouder' };
const documents = { termsVersion: '2026-11-22', privacyVersion: '2026-11-23' };
const active: ParentAccountStatus = { state: 'active', ...documents, acceptedTermsVersion: documents.termsVersion, shownPrivacyVersion: documents.privacyVersion, lastActivityAt: '2026-11-22T12:00:00Z', deletionDeadline: null, consents: [] };
const pending: ParentAccountStatus = { ...active, state: 'onboarding', acceptedTermsVersion: null, shownPrivacyVersion: null };
const existing: FamilySnapshot = { schemaVersion: 1, family: { version: 1, children: [{ id: 'child-registration-existing', name: 'Avonturier', avatar: 0 }], activeId: 'child-registration-existing' }, data: { 'child-registration-existing': {} } };

// Model the unordered object keys returned by PostgreSQL JSONB without changing
// the profile or story-choice array order.
function jsonbOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonbOrder);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .sort(([a], [b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => [key, jsonbOrder(item)]));
  return value;
}

async function mockAccount(page: Page, getState: () => { signedIn: boolean; status: ParentAccountStatus }) {
  await page.route('**/api/legal/documents', route => route.fulfill({ json: documents }));
  await page.route('**/api/auth/session', route => {
    const state = getState();
    return route.fulfill({ json: { configured: true, parent: state.signedIn ? parent : null, admin: false, providers: { email: true, google: true }, ...(state.signedIn ? { lifecycle: state.status } : {}) } });
  });
  await page.route('**/api/parent/status', route => route.fulfill({ json: getState().status }));
  await page.route('**/api/parent/activity', route => route.fulfill({ json: { ok: true } }));
}

function watchRepeatedDeclarations(page: Page) {
  let submissions = 0;
  const routeReady = page.route('**/api/parent/onboarding', route => {
    submissions++;
    return route.fulfill({ status: 500, json: { error: 'unexpected_repeated_declarations', message: 'Deze synthetische flow mag geen tweede ouderverklaring versturen.' } });
  });
  return { routeReady, count: () => submissions };
}

async function expectNoParentDeclarations(page: Page) {
  await expect(page.getByRole('checkbox', { name: /Ik ben 18 jaar/ })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Ik ga akkoord/ })).toHaveCount(0);
  await expect(page.getByRole('checkbox', { name: /Ja, ik ontvang graag promotionele e-mails/ })).toHaveCount(0);
}

test('one registration declaration and terms choice survive OTP verification and open the first JSONB family profile', async ({ page }) => {
  let signedIn = false;
  await mockAccount(page, () => ({ signedIn, status: active }));
  const repeated = watchRepeatedDeclarations(page); await repeated.routeReady;
  let otpRequests = 0, verifications = 0, consents = 0, uploads = 0, completionRequests = 0;
  let snapshot: FamilySnapshot | null = null;
  await page.route('**/api/auth/otp', route => {
    otpRequests++;
    expect(route.request().postDataJSON()).toEqual({ email: parent.email, intent: 'register', parentDeclaration: true, acceptTerms: true, marketingConsent: true, ...documents });
    return route.fulfill({ json: { ok: true, message: 'De synthetische inlogcode is aangevraagd.' } });
  });
  await page.route('**/api/auth/verify', route => {
    verifications++; signedIn = true;
    expect(route.request().postDataJSON()).toEqual({ email: parent.email, token: '123456', next: '/gezin' });
    return route.fulfill({ json: { ok: true, next: '/gezin', parent, lifecycle: active } });
  });
  await page.route('**/api/auth/registration/complete', route => { completionRequests++; return route.fulfill({ status: 500, json: {} }); });
  await page.route('**/api/parent/consent', route => {
    consents++;
    expect(route.request().postDataJSON()).toMatchObject({ consent: true, guardianDeclaration: true });
    return route.fulfill({ json: active });
  });
  await page.route('**/api/family', route => {
    expect(signedIn).toBe(true);
    if (route.request().method() === 'PUT') { uploads++; snapshot = route.request().postDataJSON().snapshot; }
    return route.fulfill({ json: jsonbOrder({ parent, revision: uploads, snapshot }) });
  });

  await page.goto('/inloggen');
  await page.getByRole('button', { name: 'Ouderaccount maken', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(3);
  const marketing = page.getByRole('checkbox', { name: /Ja, ik ontvang graag promotionele e-mails/ });
  await expect(marketing).not.toBeChecked();
  await marketing.check();
  await page.getByRole('checkbox', { name: /Ik ben 18 jaar/ }).check();
  await page.getByRole('checkbox', { name: /Ik ga akkoord/ }).check();
  await page.getByRole('textbox', { name: 'Jouw e-mailadres' }).fill(parent.email);
  await page.getByRole('button', { name: 'Stuur mij een inlogcode' }).click();
  await expectNoParentDeclarations(page);
  await page.getByRole('textbox', { name: '6-cijferige code uit je e-mail' }).fill('123456');
  await page.getByRole('button', { name: 'Veilig inloggen' }).click();
  await expect(page).toHaveURL(/\/gezin$/);
  const create = page.getByRole('button', { name: 'Nieuw kindprofiel bewaren' });
  await expect(create).toBeDisabled();
  await expectNoParentDeclarations(page);
  // Child-specific consent remains a separate, required decision.
  await expect(page.getByRole('checkbox')).toHaveCount(1);
  expect(uploads).toBe(0); expect(consents).toBe(0);
  await page.getByRole('checkbox', { name: /Ik ben ouder met gezag of voogd en geef toestemming/ }).check();
  await page.locator('#onboarding-child-name').fill('Avonturier');
  await page.locator('#onboarding-child-birth-date').fill('2019-11-23');
  await create.click();
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expect(page.getByText('Avonturen bewaard', { exact: true })).toBeVisible();
  await expectNoParentDeclarations(page);
  expect({ otpRequests, verifications, consents, uploads, completionRequests, repeated: repeated.count() }).toEqual({ otpRequests: 1, verifications: 1, consents: 1, uploads: 1, completionRequests: 0, repeated: 0 });
  expect(snapshot).toHaveProperty('family.children.length', 1);
  expect(JSON.stringify(snapshot)).not.toContain('marketingConsent');
});

test('an already active parent opening onboarding goes directly to the family without another declaration or completion', async ({ page }) => {
  await mockAccount(page, () => ({ signedIn: true, status: active }));
  const repeated = watchRepeatedDeclarations(page); await repeated.routeReady;
  let completions = 0, writes = 0;
  await page.route('**/api/auth/registration/complete', route => { completions++; return route.fulfill({ status: 500, json: {} }); });
  await page.route('**/api/family', route => { if (route.request().method() !== 'GET') writes++; return route.fulfill({ json: jsonbOrder({ parent, revision: 1, snapshot: existing }) }); });
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/gezin$/);
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expectNoParentDeclarations(page);
  expect({ completions, writes, repeated: repeated.count() }).toEqual({ completions: 0, writes: 0, repeated: 0 });
});

test('a temporary saved-proof completion failure retries existing choices without displaying fresh declaration checkboxes', async ({ page }) => {
  let completed = false;
  await mockAccount(page, () => ({ signedIn: true, status: completed ? active : pending }));
  const repeated = watchRepeatedDeclarations(page); await repeated.routeReady;
  let completions = 0;
  await page.route('**/api/auth/registration/complete', route => {
    completions++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['x-fabelpad-parent']).toBe(parent.id);
    expect(route.request().postDataJSON()).toEqual({});
    if (completions === 1) return route.fulfill({ status: 503, json: { error: 'backend_unavailable', message: 'Registratie afronden is tijdelijk niet bereikbaar. Je eerdere keuzes blijven bewaard.' } });
    completed = true;
    return route.fulfill({ json: { completed: true, lifecycle: active } });
  });
  await page.route('**/api/family', route => route.fulfill({ json: jsonbOrder({ parent, revision: 1, snapshot: existing }) }));
  await page.goto('/onboarding');
  await expect(page.getByText('Registratie afronden is tijdelijk niet bereikbaar. Je eerdere keuzes blijven bewaard.', { exact: true })).toBeVisible();
  await expectNoParentDeclarations(page);
  const retry = page.getByRole('button', { name: 'Registratie opnieuw afronden', exact: true });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(page).toHaveURL(/\/gezin$/);
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expectNoParentDeclarations(page);
  expect(completions).toBe(2);
  expect(repeated.count()).toBe(0);
});
