import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { PrivacyCase } from '../../lib/privacyAdmin';

const parent = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.test', displayName: 'Beheerder' };
const lifecycle = { state: 'active', termsVersion: '2026-11-22', privacyVersion: '2026-11-22.1', acceptedTermsVersion: '2026-11-22', shownPrivacyVersion: '2026-11-22.1', lastActivityAt: '2026-11-22T12:00:00Z', deletionDeadline: null, consents: [] };
const draft = { metadata: { title: 'Het Verdwaalde Station', description: 'Een stationsavontuur.', image: '/art/station.webp' }, chapters: {}, updatedAt: '2026-11-23T12:00:00Z' };
const settings = { fromName: 'Fabelpad', fromEmail: 'noreply@example.test', replyTo: 'support@example.test', supportEmail: 'support@example.test', footerText: 'Een servicebericht van Fabelpad.', templates: {} };
const email = { environment: 'staging', appOrigin: 'https://staging.example.test', configured: true, source: 'vault', revision: 3, keyConfigured: true, settings, lastTestAt: null, auth: { emailEnabled: true, googleEnabled: false } };
async function session(page: Page) { await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent, admin: true, lifecycle } })); }
async function emailRoutes(page: Page) {
  await page.route('**/api/admin/email', route => route.fulfill({ json: email }));
  await page.route('**/api/admin/email/domain', route => route.fulfill({ json: { status: 'restricted', domain: 'example.test', records: [], tracking: { open: null, click: null } } }));
  await page.route('**/api/admin/email/preview', route => route.fulfill({ json: { html: '<html><body><h1>Testvoorbeeld</h1></body></html>', subject: 'Testvoorbeeld' } }));
}

test('shared administration drawer traps focus, restores it and keeps real links at narrow widths', async ({ page }) => {
  await session(page);
  await page.goto('/studio/overzicht');
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.getByRole('button', { name: 'Beheermenu openen' });
  await toggle.click();
  const dialog = page.getByRole('dialog', { name: 'Platformbeheer' });
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Beheermenu sluiten' });
  await expect(close).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link', { name: 'Mijn account', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await expect(dialog.getByRole('link', { name: 'Abonnementen & betalingen', exact: true })).toHaveAttribute('href', '/studio/betalingen');
  await expect(dialog.getByRole('link', { name: 'Online verhalen', exact: true })).toHaveAttribute('href', '/studio/premium');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(toggle).toBeFocused();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `cockpit width ${width}` }).toBeTruthy();
  }
  await expect(page.getByRole('navigation', { name: 'Beheeronderdelen' }).getByRole('link', { name: 'Cockpit', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.screenshot({ path: '/tmp/fabelpad-admin-cockpit-1440.png', fullPage: true });
});

test('studio exposes all 31 real paths and updates completeness and the name preview', async ({ page }) => {
  await session(page);
  await page.route('**/api/content/drafts/station', route => route.fulfill({ json: { revision: 3, draft } }));
  await page.goto('/studio');
  await expect(page.getByLabel('Verhaaltitel', { exact: true })).toHaveValue(draft.metadata.title);
  let totalPaths = 0;
  for (let part = 0; part < 5; part++) {
    await page.getByRole('combobox', { name: 'Deel', exact: true }).selectOption(String(part));
    const paths = page.getByRole('group', { name: `Paden in deel ${part + 1}` }).getByRole('button');
    await expect(paths).toHaveCount(2 ** part);
    totalPaths += await paths.count();
    await paths.last().click();
    await expect(paths.last()).toHaveAttribute('aria-pressed', 'true');
  }
  expect(totalPaths).toBe(31);
  await expect(page.getByRole('progressbar', { name: 'Complete delen en omslag' })).toHaveAttribute('value', '6');
  await page.getByLabel('Hoofdstuktitel', { exact: true }).fill('Hallo {{naam}}');
  await page.getByLabel('Voorbeeldnaam', { exact: true }).fill('Robin');
  await expect(page.getByRole('region', { name: 'Concept bekijken' }).getByRole('heading', { name: 'Hallo Robin' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Verhaaltekst', exact: true }).fill('');
  await expect(page.getByRole('progressbar', { name: 'Complete delen en omslag' })).toHaveAttribute('value', '5');
  await expect(page.getByText('15/31 paden', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publiceren…', exact: true })).toBeDisabled();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `studio width ${width}` }).toBeTruthy();
  }
});

test('a studio revision conflict preserves work, downloads it and recovers it after a server reload', async ({ page }) => {
  await session(page);
  let serverRevision = 3;
  let publication: unknown = null;
  const writes: Record<string, unknown>[] = [];
  await page.route('**/api/content/drafts/station', route => {
    if (route.request().method() === 'PUT') { writes.push(route.request().postDataJSON()); serverRevision = 4; return route.fulfill({ status: 409, json: { message: 'revision conflict' } }); }
    return route.fulfill({ json: { revision: serverRevision, draft } });
  });
  await page.route('**/api/content/publish/station', route => { publication = route.request().postDataJSON(); return route.fulfill({ json: { release: { contentVersion: 'synthetic-v5' } } }); });
  await page.goto('/studio');
  await page.getByLabel('Verhaaltitel', { exact: true }).fill('Mijn behouden tekst');
  await page.getByRole('button', { name: 'Concept bewaren', exact: true }).click();
  await expect(page.locator('.account-feedback[role=alert]')).toContainText('Jouw tekst is behouden');
  expect(writes[0].baseRevision).toBe(3);
  await expect(page.getByLabel('Verhaaltitel', { exact: true })).toHaveValue('Mijn behouden tekst');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Concept downloaden', exact: true }).click();
  const file = await downloaded;
  expect(JSON.parse(await readFile((await file.path())!, 'utf8'))).toMatchObject({ storyId: 'station', baseRevision: 3, draft: { metadata: { title: 'Mijn behouden tekst' } } });
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Actueel serverconcept laden', exact: true }).click();
  await expect(page.getByLabel('Verhaaltitel', { exact: true })).toHaveValue(draft.metadata.title);
  await expect(page.getByRole('heading', { name: 'Er staat een browserherstel klaar', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Browserherstel overnemen', exact: true }).click();
  await expect(page.getByLabel('Verhaaltitel', { exact: true })).toHaveValue('Mijn behouden tekst');
  expect(publication).toBeNull();
  await page.unroute('**/api/content/drafts/station');
  await page.route('**/api/content/drafts/station', route => { writes.push(route.request().postDataJSON()); return route.fulfill({ json: { revision: 5 } }); });
  await page.getByRole('button', { name: 'Concept bewaren', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Publiceren…', exact: true })).toBeEnabled();
  expect(writes.at(-1)).toMatchObject({ baseRevision: 4, draft: { metadata: { title: 'Mijn behouden tekst' } } });
  await page.getByRole('button', { name: 'Publiceren…', exact: true }).click();
  expect(publication).toBeNull();
  await page.getByRole('button', { name: 'Bevestig publicatie', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Gepubliceerde contentrelease bekijken →' })).toHaveAttribute('href', '/api/content/station?version=synthetic-v5');
  expect(publication).toEqual({ baseRevision: 5 });
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('fabelpad-studio-recovery-v1:')))).toBeFalsy();
});

test('all 17 email identities remain editable and exports copy real Supabase placeholders', async ({ page, context }) => {
  await session(page); await emailRoutes(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/studio/email/templates');
  const templates = page.getByRole('navigation', { name: 'Alle e-mailtemplates' }).getByRole('button');
  await expect(templates).toHaveCount(17);
  await page.getByRole('combobox', { name: 'Templatecategorie', exact: true }).selectOption('service');
  await expect(templates).toHaveCount(4);
  await expect(page.getByRole('heading', { name: 'Servicebericht vanuit Fabelpad', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'HTML kopiëren voor Supabase', exact: true })).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Templatecategorie', exact: true }).selectOption('auth');
  await expect(templates).toHaveCount(13);
  await page.getByRole('button', { name: 'HTML kopiëren voor Supabase', exact: true }).click();
  const html = await page.evaluate(() => navigator.clipboard.readText());
  expect(html).toContain('{{ .Token }}');
  expect(html).not.toContain('re_synthetic');
  await page.getByRole('button', { name: 'Onderwerp kopiëren', exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(await page.getByLabel('Onderwerp voor Supabase', { exact: true }).inputValue());
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `templates width ${width}` }).toBeTruthy();
  }
});

test('privacy page filters actual current-page cases without losing pagination or implying completion', async ({ page }) => {
  await session(page);
  const base: PrivacyCase = { id: 'case1', reference: 'AVG_OPEN_01', kind: 'access', scope: 'parent', parentId: parent.id, profileId: null, verification: 'pending', state: 'received', receivedAt: '2026-11-22T12:00:00Z', responseDueAt: '2026-12-22T12:00:00Z', verificationMethod: null, firstResponseAt: null, completedAt: null, extendedDueAt: null, extensionReason: null };
  await page.route('**/api/admin/privacy**', route => route.fulfill({ json: { cases: [base, { ...base, id: 'case2', reference: 'AVG_CLOSED_02', state: 'completed', kind: 'erasure' }], total: 102, truncated: true, nextOffset: 100 } }));
  await page.goto('/studio/privacy');
  await page.getByRole('combobox', { name: 'Zaakstatus op deze pagina', exact: true }).selectOption('open');
  await expect(page.getByRole('combobox', { name: 'Privacyverzoek', exact: true }).locator('option')).toHaveCount(1);
  await page.getByLabel('Zoek dossierkenmerk op deze pagina', { exact: true }).fill('CLOSED');
  await expect(page.getByRole('status').filter({ hasText: 'Geen zaken binnen deze filters' })).toBeVisible();
  await expect(page.locator('.privacy-admin-case')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Volgende pagina', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Filters wissen', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Privacyverzoek', exact: true }).locator('option')).toHaveCount(2);
  await page.getByRole('combobox', { name: 'Verzoeksoort op deze pagina', exact: true }).selectOption('erasure');
  await expect(page.getByRole('heading', { name: 'AVG_CLOSED_02', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gegevenswissing uitvoeren', exact: true })).toHaveCount(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), { message: `privacy width ${width}` }).toBeTruthy();
  }
});


test('studio recovery is bound to the exact account and remains downloadable during server failure', async ({ page }) => {
  await session(page);
  await page.addInitScript(({ owner, fixture }) => {
    localStorage.setItem(`fabelpad-studio-recovery-v1:${encodeURIComponent(owner)}:station`, JSON.stringify({ storyId: 'station', baseRevision: 2, draft: { ...fixture, metadata: { ...fixture.metadata, title: 'Mijn offline redactiewerk' } }, savedAt: '2026-11-23T12:00:00Z' }));
    localStorage.setItem('fabelpad-studio-recovery-v1:another-owner:station', JSON.stringify({ storyId: 'station', baseRevision: 99, draft: { ...fixture, metadata: { ...fixture.metadata, title: 'Andermans redactiewerk' } }, savedAt: '2026-11-23T12:00:00Z' }));
  }, { owner: parent.id, fixture: draft });
  await page.route('**/api/content/drafts/station', route => route.fulfill({ status: 503, json: { message: 'De server is tijdelijk niet bereikbaar.' } }));
  await page.goto('/studio');
  await expect(page.locator('.account-feedback[role=alert]')).toContainText('tijdelijk niet bereikbaar');
  await expect(page.getByRole('button', { name: 'Browserherstel overnemen', exact: true })).toBeDisabled();
  const pendingDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Herstelkopie downloaden', exact: true }).click();
  const download = await pendingDownload;
  expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toMatchObject({ baseRevision: 2, draft: { metadata: { title: 'Mijn offline redactiewerk' } } });
  expect(await page.locator('body').innerText()).not.toContain('Andermans redactiewerk');
});

test('a rejected studio mutation removes the editor and requires administrator login', async ({ page }) => {
  await session(page);
  await page.route('**/api/content/drafts/station', route => route.fulfill(route.request().method() === 'PUT' ? { status: 403, json: { message: 'admin_required' } } : { json: { revision: 3, draft } }));
  await page.goto('/studio');
  await page.getByLabel('Verhaaltitel', { exact: true }).fill('Niet meer bevoegd');
  await page.getByRole('button', { name: 'Concept bewaren', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Inloggen als beheerder', exact: true })).toHaveAttribute('href', '/inloggen?next=%2Fstudio');
  await expect(page.getByLabel('Verhaaltitel', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Browserherstel overnemen', exact: true })).toHaveCount(0);
});
