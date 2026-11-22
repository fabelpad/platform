import { test, expect, type Page } from '@playwright/test';

const parent = { id: 'synthetic-mail-admin', email: 'admin@example.test', displayName: 'Testbeheerder' };
const settings = {
  fromName: 'Fabelpad', fromEmail: 'noreply@example.test', replyTo: 'support@example.test',
  supportEmail: 'support@example.test', footerText: 'Een servicebericht van Fabelpad.', templates: {},
};
const saved = { environment: 'staging', appOrigin: 'https://staging.example.test', configured: true, source: 'vault', revision: 3, keyConfigured: true, settings, lastTestAt: null, auth: { emailEnabled: true, googleEnabled: false } };
async function mockSession(page: Page, admin = true) {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent, admin, providers: { email: true, google: false } } }));
}
async function mockReadRoutes(page: Page) {
  await mockSession(page);
  await page.route('**/api/admin/email', route => route.fulfill({ json: saved }));
  await page.route('**/api/admin/email/domain', route => route.fulfill({ json: { status: 'restricted', domain: 'example.test', records: [], tracking: { open: null, click: null } } }));
  await page.route('**/api/admin/email/preview', route => route.fulfill({ json: { html: '<html><body><h1>Een fictieve e-mail</h1><p>000000</p></body></html>', subject: 'Een fictieve e-mail' } }));
}

test('only an authenticated administrator opens email settings', async ({ page }) => {
  let configurationRequests = 0;
  await mockSession(page, false);
  await page.route('**/api/admin/email', route => { configurationRequests++; return route.fulfill({ json: saved }); });
  await page.goto('/studio/email');
  await expect(page.getByText('Dit account heeft geen toegang tot de e-mailinstellingen.')).toBeVisible();
  await expect(page.getByLabel('Resend API-key')).toHaveCount(0);
  expect(configurationRequests).toBe(0);
  await page.unroute('**/api/auth/session');
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent: null, admin: false } }));
  await page.reload();
  await expect(page.getByRole('link', { name: 'Inloggen als beheerder', exact: true })).toHaveAttribute('href', '/inloggen?next=%2Fstudio%2Femail');
});

test('saved settings expose no key and distinguish domain permissions from connection status', async ({ page }) => {
  await mockReadRoutes(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio/email');
  await expect(page.getByRole('heading', { name: 'Resend is gekoppeld' })).toBeVisible();
  await expect(page.getByText('Staging · testomgeving', { exact: true })).toBeVisible();
  await expect(page.getByText(parent.email, { exact: true })).toBeVisible();
  await expect(page.getByLabel('Resend API-key')).toHaveValue('');
  await expect(page.getByText('Je API-key kan e-mail versturen, maar heeft geen rechten om domeingegevens op te vragen.', { exact: false })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Beheeronderdelen' }).getByRole('link', { name: 'E-mailtemplates', exact: true })).toHaveAttribute('href', '/studio/email/templates');
  await expect(page.getByLabel('Onderwerp', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Testmail opnieuw versturen' })).toBeDisabled();
  await page.getByLabel('Open- en kliktracking staan uit in Resend').check();
  await expect(page.getByRole('button', { name: 'Testmail opnieuw versturen' })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('save validates a candidate with a test and clears the entered key after success', async ({ page }) => {
  await mockReadRoutes(page);
  let input: Record<string, unknown> | undefined;
  let finishSave: (() => void) | undefined;
  await page.unroute('**/api/admin/email');
  await page.route('**/api/admin/email', async route => {
    if (route.request().method() === 'PUT') {
      input = route.request().postDataJSON();
      await new Promise<void>(resolve => { finishSave = resolve; });
      await route.fulfill({ json: { ...saved, revision: 4, settings: input?.settings, lastTestAt: '2026-11-22T12:00:00.000Z', test: { accepted: true } } });
    } else await route.fulfill({ json: saved });
  });
  await page.goto('/studio/email');
  await page.getByLabel('Naam afzender', { exact: true }).fill('Fabelpad voor ouders');
  await page.getByLabel('Resend API-key').fill('re_synthetic_key_for_browser_test');
  await page.getByLabel('Open- en kliktracking staan uit in Resend').check();
  await page.getByRole('button', { name: 'Opslaan en testmail versturen', exact: true }).click();
  await expect(page.getByLabel('Naam afzender', { exact: true })).toBeDisabled();
  await expect.poll(() => !!finishSave).toBeTruthy();
  expect(input?.apiKey).toBe('re_synthetic_key_for_browser_test');
  expect(input?.baseRevision).toBe(3);
  expect(input?.requestId).toMatch(/^[a-f0-9-]{36}$/);
  expect(input).not.toHaveProperty('recipient');
  expect(input?.trackingDisabledConfirmed).toBe(true);
  finishSave!();
  await expect(page.getByLabel('Resend API-key')).toHaveValue('');
  await expect(page.getByLabel('Naam afzender', { exact: true })).toHaveValue('Fabelpad voor ouders');
  await expect(page.getByRole('status').filter({ hasText: 'Je instellingen zijn opgeslagen.' })).toContainText('dit bevestigt nog geen aflevering');
  expect(await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }))).not.toContain('re_synthetic_key_for_browser_test');
});

test('a template save conflict preserves edits and allows a synthetic unsaved preview', async ({ page }) => {
  await mockReadRoutes(page);
  const previews: Record<string, unknown>[] = [];
  await page.unroute('**/api/admin/email');
  await page.route('**/api/admin/email', route => route.fulfill(route.request().method() === 'PUT' ? { status: 409, json: { error: 'settings_changed', message: 'Conflict' } } : { json: saved }));
  await page.unroute('**/api/admin/email/preview');
  await page.route('**/api/admin/email/preview', route => {
    previews.push(route.request().postDataJSON());
    return route.fulfill({ json: { html: '<html><body><h1>Fictief voorbeeld</h1></body></html>', subject: 'Fictief voorbeeld' } });
  });
  await page.goto('/studio/email/templates');
  await expect(page.getByRole('navigation', { name: 'Alle e-mailtemplates' }).getByRole('button')).toHaveCount(17);
  await expect(page.locator('iframe')).toHaveAttribute('sandbox', '');
  await expect(page.locator('iframe')).toHaveAttribute('srcdoc', /default-src 'none'/);
  await expect(page.frameLocator('iframe').getByRole('heading', { name: 'Fictief voorbeeld' })).toBeVisible();
  await page.getByLabel('Onderwerp', { exact: true }).fill('Jouw persoonlijke inlogcode');
  await page.getByLabel('Open- en kliktracking staan uit in Resend').check();
  await expect(page.getByRole('button', { name: 'Voorbeeld bijwerken', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Voorbeeld bijwerken', exact: true }).click();
  await expect.poll(() => previews.at(-1)?.settings).toMatchObject({ templates: { magiclink: { subject: 'Jouw persoonlijke inlogcode' } } });
  expect(previews.at(-1)).not.toHaveProperty('apiKey');
  expect(Object.keys((previews.at(-1)?.settings as { templates: { magiclink: object } }).templates.magiclink).sort()).toEqual(['intro', 'subject', 'title']);
  await page.getByRole('button', { name: 'Opslaan en testmail versturen', exact: true }).click();
  await expect(page.locator('.email-error[role=alert]')).toContainText('Jouw wijzigingen blijven in dit venster');
  await expect(page.getByLabel('Onderwerp', { exact: true })).toHaveValue('Jouw persoonlijke inlogcode');
  await expect(page.getByLabel('Resend API-key')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Testmail opnieuw versturen', exact: true })).toBeDisabled();
});

test('expired administrator access removes the settings form after a rejected mutation', async ({ page }) => {
  await mockReadRoutes(page);
  await page.route('**/api/admin/email/test', route => route.fulfill({ status: 403, json: { error: 'admin_required' } }));
  await page.goto('/studio/email');
  await page.getByLabel('Open- en kliktracking staan uit in Resend').check();
  await page.getByRole('button', { name: 'Testmail opnieuw versturen', exact: true }).click();
  await expect(page.locator('.email-error[role=alert]')).toContainText('Je beheersessie is verlopen');
  await expect(page.getByRole('link', { name: 'Opnieuw inloggen als beheerder →', exact: true })).toBeVisible();
  await expect(page.getByLabel('Resend API-key')).toHaveCount(0);
  await expect(page.locator('iframe')).toHaveCount(0);
});


test('a rejected connection save clears its key while preserving sender edits', async ({ page }) => {
  await mockReadRoutes(page);
  await page.unroute('**/api/admin/email');
  await page.route('**/api/admin/email', route => route.fulfill(route.request().method() === 'PUT' ? { status: 502, json: { message: 'De verbinding met Resend kon niet worden bevestigd.' } } : { json: saved }));
  await page.goto('/studio/email');
  await page.getByLabel('Naam afzender', { exact: true }).fill('Nieuw afzenderlabel');
  await page.getByLabel('Resend API-key').fill('re_synthetic_rejected_key');
  await page.getByLabel('Open- en kliktracking staan uit in Resend').check();
  await page.getByRole('button', { name: 'Opslaan en testmail versturen', exact: true }).click();
  await expect(page.locator('.email-error[role=alert]')).toContainText('De verbinding met Resend kon niet worden bevestigd');
  await expect(page.getByLabel('Resend API-key')).toHaveValue('');
  await expect(page.getByLabel('Naam afzender', { exact: true })).toHaveValue('Nieuw afzenderlabel');
});

test('connection saves merge fresh templates instead of overwriting another page', async ({ page }) => {
  await mockReadRoutes(page);
  let concurrent = false;
  let input: { baseRevision: number; settings: typeof settings & { templates: object } } | undefined;
  const concurrentTemplates = { welcome: { subject: 'Nieuwe welkomsmail', title: 'Welkom', intro: 'Er liggen verhalen klaar.' } };
  await page.unroute('**/api/admin/email');
  await page.route('**/api/admin/email', route => {
    if (route.request().method() === 'PUT') {
      input = route.request().postDataJSON();
      return route.fulfill({ json: { ...saved, revision: 5, settings: input?.settings, test: { accepted: true } } });
    }
    return route.fulfill({ json: concurrent ? { ...saved, revision: 4, settings: { ...settings, templates: concurrentTemplates } } : saved });
  });
  await page.goto('/studio/email');
  await page.getByLabel('Naam afzender', { exact: true }).fill('Fabelpad gezinnen');
  concurrent = true;
  await page.getByLabel('Open- en kliktracking staan uit in Resend').check();
  await page.getByRole('button', { name: 'Opslaan en testmail versturen', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Je instellingen zijn opgeslagen.' })).toBeVisible();
  expect(input?.baseRevision).toBe(4);
  expect(input?.settings.templates).toEqual(concurrentTemplates);
  expect(input?.settings.fromName).toBe('Fabelpad gezinnen');
});

test('all service templates can be edited and preserve fresh sender settings on save', async ({ page }) => {
  await mockReadRoutes(page);
  let concurrent = false;
  let input: Record<string, unknown> | undefined;
  await page.unroute('**/api/admin/email');
  await page.route('**/api/admin/email', route => {
    if (route.request().method() === 'PUT') {
      input = route.request().postDataJSON();
      return route.fulfill({ json: { ...saved, revision: 5, settings: input?.settings, test: { accepted: true } } });
    }
    return route.fulfill({ json: concurrent ? { ...saved, revision: 4, settings: { ...settings, fromName: 'Fabelpad service' } } : saved });
  });
  await page.goto('/studio/email/templates');
  const list = page.getByRole('navigation', { name: 'Alle e-mailtemplates' });
  await expect(list.getByRole('button')).toHaveCount(17);
  await list.getByRole('button', { name: /Welkom bij Fabelpad/ }).click();
  await page.getByLabel('Onderwerp', { exact: true }).fill('Welkom in de wereld van Fabelpad');
  concurrent = true;
  await page.getByLabel('Open- en kliktracking staan uit in Resend').check();
  await page.getByRole('button', { name: 'Opslaan en testmail versturen', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Je instellingen zijn opgeslagen.' })).toBeVisible();
  expect(input?.baseRevision).toBe(4);
  expect(input?.settings).toMatchObject({ fromName: 'Fabelpad service', templates: { welcome: { subject: 'Welkom in de wereld van Fabelpad' } } });
  expect(input).not.toHaveProperty('apiKey');
});

test('a tracking restriction explains the provider setting without a false edit conflict', async ({ page }) => {
  await mockReadRoutes(page);
  await page.route('**/api/admin/email/test', route => route.fulfill({ status: 409, json: { error: 'tracking_enabled', message: 'Zet open- en kliktracking uit bij je domein in Resend.' } }));
  await page.goto('/studio/email');
  await page.getByLabel('Open- en kliktracking staan uit in Resend').check();
  await page.getByRole('button', { name: 'Testmail opnieuw versturen', exact: true }).click();
  await expect(page.locator('.email-error[role=alert]')).toHaveText('Zet open- en kliktracking uit bij je domein in Resend.');
  await expect(page.getByLabel('Naam afzender', { exact: true })).toHaveValue('Fabelpad');
});
