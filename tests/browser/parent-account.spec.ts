import { test, expect, type Page } from '@playwright/test';
import type { FamilySnapshot } from '../../src/profileStorage';

const parent = { id: 'synthetic-parent-legal', email: 'parent@example.test', displayName: 'Testouder' };
const current = { termsVersion: '2026-11-22', privacyVersion: '2026-11-22' };
const active = { state: 'active', ...current, acceptedTermsVersion: current.termsVersion, shownPrivacyVersion: current.privacyVersion, lastActivityAt: '2026-11-22T12:00:00Z', deletionDeadline: null, consents: [] };
async function session(page: Page, lifecycle: unknown = active) {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent, admin: false, providers: { email: true, google: true }, lifecycle } }));
  await page.route('**/api/parent/status', route => route.fulfill({ json: lifecycle }));
}

test('OTP and Google registration require separate guardian and terms choices, with no privacy checkbox', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent: null, admin: false, providers: { email: true, google: true } } }));
  await page.route('**/api/legal/documents', route => route.fulfill({ json: current }));
  let request: unknown;
  await page.route('**/api/auth/otp', route => { request = route.request().postDataJSON(); return route.fulfill({ json: { ok: true } }); });
  await page.goto('/inloggen');
  const google = page.getByRole('button', { name: 'Verder met Google' });
  await expect(google.locator('img')).toHaveAttribute('src', '/brand/google-g.svg');
  const otpBox = await page.getByRole('button', { name: 'Stuur mij een inlogcode' }).boundingBox();
  const googleBox = await google.boundingBox();
  expect(googleBox!.y).toBeGreaterThan(otpBox!.y);
  await page.getByRole('button', { name: 'Ouderaccount maken', exact: true }).click();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  await expect(google).toBeDisabled();
  await page.getByRole('checkbox', { name: /Ik ben 18 jaar/ }).check();
  await expect(google).toBeDisabled();
  await page.getByRole('checkbox', { name: /Ik ga akkoord/ }).check();
  await expect(google).toBeEnabled();
  await page.getByRole('textbox', { name: 'Jouw e-mailadres' }).fill(parent.email);
  await page.getByRole('button', { name: 'Stuur mij een inlogcode' }).click();
  expect(request).toEqual({ email: parent.email, intent: 'register', parentDeclaration: true, acceptTerms: true, ...current });
  const code = page.getByRole('textbox', { name: '6-cijferige code uit je e-mail' });
  await expect(code).toHaveAttribute('maxlength', '6');
  await expect(code).toHaveAttribute('pattern', '[0-9]{6}');
});

test('onboarding uses current server document versions and leaves family APIs untouched', async ({ page }) => {
  const fresh = { ...active, state: 'onboarding', acceptedTermsVersion: null, shownPrivacyVersion: null };
  await session(page, fresh);
  let uploads = 0;
  await page.route('**/api/family', route => { uploads++; return route.fulfill({ status: 403, json: {} }); });
  await page.goto('/gezin');
  await expect(page.getByRole('heading', { name: 'Rond je ouderaccount af.' })).toBeVisible();
  expect(uploads).toBe(0);
  await page.goto('/onboarding');
  const finish = page.getByRole('button', { name: 'Ouderaccount afronden' });
  await expect(finish).toBeDisabled();
  await expect(page.getByRole('checkbox')).toHaveCount(2);
  await page.getByRole('checkbox', { name: /Ik ben 18 jaar/ }).check();
  await expect(finish).toBeDisabled();
  await page.getByRole('checkbox', { name: /Ik ga akkoord/ }).check();
  await expect(finish).toBeEnabled();
  await expect(page.getByText('De privacyverklaring is informatie;', { exact: false })).toBeVisible();
  expect(uploads).toBe(0);
});

test('a document version change clears acceptance and shows the new version before retry', async ({ page }) => {
  const fresh = { ...active, state: 'onboarding', acceptedTermsVersion: null, shownPrivacyVersion: null };
  let status = fresh;
  await session(page, fresh);
  await page.unroute('**/api/parent/status');
  await page.route('**/api/parent/status', route => route.fulfill({ json: status }));
  await page.route('**/api/parent/onboarding', route => { status = { ...fresh, termsVersion: '2026-11-23' }; return route.fulfill({ status: 409, json: { error: 'terms_changed', message: 'De versie is bijgewerkt.' } }); });
  await page.goto('/onboarding');
  await page.getByRole('checkbox', { name: /Ik ben 18 jaar/ }).check();
  await page.getByRole('checkbox', { name: /Ik ga akkoord/ }).check();
  await page.getByRole('button', { name: 'Ouderaccount afronden' }).click();
  await expect(page.getByRole('checkbox', { name: /Ik ga akkoord/ })).not.toBeChecked();
  await expect(page.getByText('De documenten zijn bijgewerkt.', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: 'algemene voorwaarden van Fabelpad' })).toHaveAttribute('href', '/algemene-voorwaarden?versie=2026-11-23');
});

test('an optional online child profile is never uploaded before its own consent', async ({ page }) => {
  await session(page);
  let uploads = 0, consents = 0;
  let snapshot: unknown = null;
  await page.route('**/api/parent/consent', route => { consents++; return route.fulfill({ json: active }); });
  await page.route('**/api/family', route => { if (route.request().method() === 'PUT') { uploads++; snapshot = route.request().postDataJSON().snapshot; } return route.fulfill({ json: { parent, revision: uploads, snapshot } }); });
  await page.goto('/gezin');
  const create = page.getByRole('button', { name: 'Start met een nieuw profiel Avonturier' });
  await expect(create).toBeDisabled();
  await expect(page.getByRole('link', { name: 'Verder lezen zonder online kinderprofiel →' })).toBeVisible();
  expect(uploads).toBe(0);
  await page.getByRole('checkbox').check();
  await create.click();
  await expect(page.locator('.world-card')).toHaveCount(13);
  expect(consents).toBe(1);
  expect(uploads).toBe(1);
  expect((snapshot as { family: { children: { name: string; avatar: number }[] } }).family.children[0]).toMatchObject({ name: 'Avonturier', avatar: 0 });
});

test('signing into a pending deletion never restores it; a separate explicit action is required', async ({ page }) => {
  const pending = { ...active, state: 'deletion_pending', deletionDeadline: '2026-12-22T12:00:00Z' };
  await session(page, pending);
  let restorations = 0;
  await page.route('**/api/parent/restore', route => { restorations++; return route.fulfill({ json: { status: active } }); });
  await page.goto('/gezin');
  await expect(page.getByRole('heading', { name: 'Je account staat stil.' })).toBeVisible();
  expect(restorations).toBe(0);
  await page.goto('/profiel/account');
  await expect(page.getByText('22 december 2026 om 13:00 (Nederlandse tijd)', { exact: false })).toBeVisible();
  expect(restorations).toBe(0);
  await page.getByRole('button', { name: 'Ik wil mijn account herstellen' }).click();
  await expect(page.getByText('Je account is hersteld.', { exact: false })).toBeVisible();
  expect(restorations).toBe(1);
});

test('deletion shows family impact, requires fresh authentication and purges only the current parent cache', async ({ page }) => {
  await session(page);
  let fresh = false;
  await page.addInitScript(id => { localStorage.setItem(`fabelpad-scope-${encodeURIComponent(`parent:${id}`)}::fabelpad-family`, 'synthetic-current'); localStorage.setItem('fabelpad-scope-other::fabelpad-family', 'synthetic-other'); }, parent.id);
  await page.route('**/api/parent/deletion', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { deletionDeadlineMinute: '2026-12-22T12:00:00Z', expiresAt: '2026-11-22T12:01:00Z' } });
    expect(route.request().postDataJSON()).toEqual({ confirm: true, expectedDeadlineMinute: '2026-12-22T12:00:00Z' });
    return fresh ? route.fulfill({ json: { status: { ...active, state: 'deletion_pending', deletionDeadline: '2026-12-22T12:00:00Z' } } }) : route.fulfill({ status: 428, json: { error: 'fresh_auth_required', message: 'Bevestig opnieuw dat jij het bent.' } });
  });
  await page.goto('/profiel/account');
  await page.getByRole('button', { name: 'Account verwijderen', exact: true }).click();
  await expect(page.getByText('Alle online kinderprofielen, verhaalkeuzes, favorieten en leesvoortgang van dit gezin worden geraakt.', { exact: false })).toBeVisible();
  await expect(page.getByText('Als je nu bevestigt, kun je het account alleen herstellen tot', { exact: false })).toContainText('22 december 2026 om 13:00 (Nederlandse tijd)');
  const confirm = page.getByRole('button', { name: 'Bevestig account verwijderen' });
  await expect(confirm).toBeDisabled();
  await page.getByRole('checkbox').check();
  await confirm.click();
  await expect(page.getByRole('link', { name: 'Bevestig opnieuw met e-mailcode of Google' })).toHaveAttribute('href', '/inloggen?next=/profiel/account&reauth=1');
  fresh = true;
  await confirm.click();
  await expect(page.getByText('De definitieve verwijderdeadline is', { exact: false })).toBeVisible();
  expect(await page.evaluate(id => localStorage.getItem(`fabelpad-scope-${encodeURIComponent(`parent:${id}`)}::fabelpad-family`), parent.id)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('fabelpad-scope-other::fabelpad-family'))).toBe('synthetic-other');
});

test('deletion waits for an exact server preview and a changed minute requires a new explicit confirmation', async ({ page }) => {
  await session(page);
  let releasePreview: (() => void) | undefined;
  let previews = 0, submissions = 0;
  const submittedMinutes: string[] = [];
  await page.route('**/api/parent/deletion', async route => {
    if (route.request().method() === 'GET') {
      previews++;
      if (previews === 1) await new Promise<void>(resolve => { releasePreview = resolve; });
      return route.fulfill({ json: { deletionDeadlineMinute: previews === 1 ? '2026-12-22T12:00:00Z' : '2026-12-22T12:01:00Z' } });
    }
    submissions++; submittedMinutes.push(route.request().postDataJSON().expectedDeadlineMinute);
    return submissions === 1 ? route.fulfill({ status: 409, json: { error: 'deletion_preview_expired', message: 'De getoonde minuut is verlopen.' } }) : route.fulfill({ json: { status: { ...active, state: 'deletion_pending', deletionDeadline: '2026-12-22T12:01:37Z' } } });
  });
  await page.goto('/profiel/account');
  await page.getByRole('button', { name: 'Account verwijderen', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Bevestig account verwijderen' });
  await expect(page.getByRole('checkbox')).toBeDisabled(); await expect(confirm).toBeDisabled();
  expect(submissions).toBe(0);
  await expect.poll(() => !!releasePreview).toBeTruthy(); releasePreview!();
  const preview = page.getByText('Als je nu bevestigt, kun je het account alleen herstellen tot', { exact: false });
  await expect(preview).toContainText('22 december 2026 om 13:00 (Nederlandse tijd)');
  await page.getByRole('checkbox').check(); await confirm.click();
  await expect(preview).toContainText('22 december 2026 om 13:01 (Nederlandse tijd)');
  await expect(page.getByRole('checkbox')).not.toBeChecked(); await expect(confirm).toBeDisabled();
  await expect(page.getByText('Er is nog geen verwijderaanvraag vastgelegd.', { exact: false })).toBeVisible();
  expect(submissions).toBe(1);
  await page.getByRole('checkbox').check(); await confirm.click();
  await expect(page.getByText('De definitieve verwijderdeadline is', { exact: false })).toBeVisible();
  expect(submittedMinutes).toEqual(['2026-12-22T12:00:00Z', '2026-12-22T12:01:00Z']);
});

test('a preview requiring fresh authentication cannot confirm or submit a deletion', async ({ page }) => {
  await session(page);
  let submissions = 0;
  await page.route('**/api/parent/deletion', route => {
    if (route.request().method() !== 'GET') submissions++;
    return route.fulfill({ status: 428, json: { error: 'fresh_auth_required', message: 'Log opnieuw in om de datum te bekijken.' } });
  });
  await page.goto('/profiel/account');
  await page.getByRole('button', { name: 'Account verwijderen', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Bevestig opnieuw met e-mailcode of Google' })).toBeVisible();
  await expect(page.getByRole('checkbox')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Bevestig account verwijderen' })).toBeDisabled();
  expect(submissions).toBe(0);
});

test('fresh authentication screen stays available to an existing signed-in parent', async ({ page }) => {
  await session(page);
  await page.goto('/inloggen?next=/profiel/account&reauth=1');
  await expect(page.getByRole('textbox', { name: 'Jouw e-mailadres' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Verder met Google' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open jullie gezinsomgeving' })).toHaveCount(0);
});

test('online child creation stays behind the parent consent page, and remote withdrawal closes an open reader', async ({ page }) => {
  await session(page);
  let snapshot: FamilySnapshot = { schemaVersion: 1, family: { version: 1, children: [{ id: 'child-withdrawn', name: 'Testkind een', avatar: 0 }, { id: 'child-kept', name: 'Testkind twee', avatar: 0 }], activeId: 'child-withdrawn' }, data: { 'child-withdrawn': {}, 'child-kept': {} } };
  let revision = 1;
  await page.route('**/api/family', route => { if (route.request().method() === 'PUT') { snapshot = route.request().postDataJSON().snapshot; revision++; } return route.fulfill({ json: { parent, revision, snapshot } }); });
  await page.goto('/gezin');
  await page.getByRole('button', { name: 'Kindprofiel kiezen' }).click();
  await page.getByRole('button', { name: /Nieuw kindprofiel/ }).click();
  await expect(page.getByRole('textbox', { name: '7 + 5 =' })).toBeVisible();
  await expect(page.locator('#child-name')).toHaveCount(0);
  // The preceding profile dialog may still be leaving via AnimatePresence.
  // Act on the intended parent dialog, then wait for both transitions to finish.
  await page.getByRole('dialog', { name: 'Voor ouders', exact: true }).getByRole('button', { name: 'Sluiten', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open De Droompost' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  snapshot = { schemaVersion: 1, family: { version: 1, children: [{ id: 'child-kept', name: 'Testkind twee', avatar: 0 }], activeId: 'child-kept' }, data: { 'child-kept': {} } }; revision++;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Kindprofiel kiezen' })).toContainText('Testkind twee');
  expect(await page.evaluate(() => Object.entries(localStorage).filter(([key]) => key.includes('cloud-draft') || key.includes('parent%3A')).some(([, value]) => value.includes('Testkind een')))).toBe(false);
});

test('confirmed account deletion purges its own device scope on page load while ordinary expired login does not', async ({ page }) => {
  const deletedId = '00000000-0000-4000-8000-000000000151';
  let deleted = false;
  await page.addInitScript(id => { const key = `fabelpad-scope-${encodeURIComponent(`parent:${id}`)}::fabelpad-family`; if (!sessionStorage.getItem('synthetic-cache-seeded')) { localStorage.setItem(key, 'synthetic-family-to-clean'); localStorage.setItem('fabelpad-scope-other::fabelpad-family', 'synthetic-other-family'); sessionStorage.setItem('synthetic-cache-seeded', '1'); } }, deletedId);
  await page.route('**/api/auth/session', route => deleted ? route.fulfill({ status: 410, json: { error: 'account_deleted', message: 'Je account is definitief verwijderd.', cleanupParentId: deletedId } }) : route.fulfill({ status: 401, json: { error: 'not_authenticated', message: 'Log opnieuw in.' } }));
  await page.goto('/gezin');
  expect(await page.evaluate(id => localStorage.getItem(`fabelpad-scope-${encodeURIComponent(`parent:${id}`)}::fabelpad-family`), deletedId)).toBe('synthetic-family-to-clean');
  deleted = true; await page.reload();
  await expect(page.getByText('Je account is definitief verwijderd.')).toBeVisible();
  expect(await page.evaluate(id => localStorage.getItem(`fabelpad-scope-${encodeURIComponent(`parent:${id}`)}::fabelpad-family`), deletedId)).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('fabelpad-scope-other::fabelpad-family'))).toBe('synthetic-other-family');
});
