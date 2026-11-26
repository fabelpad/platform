import { test, expect, type Page } from '@playwright/test';

const parent = { id: 'email-preferences-parent', email: 'parent@example.test' };
const lifecycle = { state: 'active', termsVersion: 'current-terms', privacyVersion: 'current-privacy', acceptedTermsVersion: 'current-terms', shownPrivacyVersion: 'current-privacy', lastActivityAt: '2026-11-24T12:00:00Z', deletionDeadline: null, consents: [] };
async function account(page: Page, state: Omit<typeof lifecycle, 'deletionDeadline'> & { deletionDeadline: string | null } = lifecycle, getParent: () => typeof parent = () => parent) {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent: getParent(), admin: false, providers: { email: true, google: true }, lifecycle: state } }));
  await page.route('**/api/parent/status', route => route.fulfill({ json: state }));
  await page.route('**/api/family', route => route.fulfill({ json: { parent: getParent(), revision: 0, snapshot: null } }));
}

const changedMessage = 'Het ouderaccount is gewijzigd. Laad je accountoverzicht opnieuw.';
const otherParent = { id: 'other-email-preferences-parent', email: 'other-parent@example.test' };

test('existing accounts stay opted out and may later grant and withdraw email consent', async ({ page }) => {
  await account(page);
  let marketingConsent = false;
  const writes: unknown[] = [];
  await page.route('**/api/parent/email-preferences', route => {
    expect(route.request().headers()['x-fabelpad-parent']).toBe(parent.id);
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON(); writes.push(body); marketingConsent = body.marketingConsent;
    }
    return route.fulfill({ json: { marketingConsent, updatedAt: writes.length ? '2026-11-24T12:00:00Z' : null } });
  });
  await page.goto('/profiel/account');
  const checkbox = page.getByRole('checkbox', { name: /promotionele e-mails/ });
  const save = page.getByRole('button', { name: 'E-mailvoorkeur opslaan' });
  await expect(checkbox).not.toBeChecked();
  await expect(save).toBeDisabled(); expect(writes).toEqual([]);
  await checkbox.check(); await save.click();
  await expect(page.getByText('Je toestemming voor promotionele e-mails en Fabelpad-updates is opgeslagen.')).toBeVisible();
  await expect(save).toBeDisabled();
  await checkbox.uncheck(); await save.click();
  await expect(page.getByText('Je toestemming is ingetrokken.', { exact: false })).toBeVisible();
  expect(writes).toEqual([{ marketingConsent: true }, { marketingConsent: false }]);
  await page.reload(); await expect(checkbox).not.toBeChecked();
  expect(writes).toHaveLength(2);
});

test('a failed withdrawal does not claim success or change the saved preference', async ({ page }) => {
  await account(page);
  let writes = 0;
  await page.route('**/api/parent/email-preferences', route => {
    if (route.request().method() === 'POST') { writes++; return route.fulfill({ status: 503, json: { message: 'Opslaan lukt nu niet. Probeer opnieuw.' } }); }
    return route.fulfill({ json: { marketingConsent: true, updatedAt: '2026-11-24T12:00:00Z' } });
  });
  await page.goto('/profiel/account');
  const checkbox = page.getByRole('checkbox', { name: /promotionele e-mails/ });
  await expect(checkbox).toBeChecked(); await checkbox.uncheck();
  await page.getByRole('button', { name: 'E-mailvoorkeur opslaan' }).click();
  await expect(page.getByText('Opslaan lukt nu niet. Probeer opnieuw.')).toBeVisible();
  await expect(page.getByText('Je toestemming is ingetrokken.', { exact: false })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'E-mailvoorkeur opslaan' })).toBeEnabled();
  expect(writes).toBe(1);
  await page.reload(); await expect(checkbox).toBeChecked();
});

test('a changed authenticated account cannot display or edit another parent preference', async ({ page }) => {
  await account(page);
  let writes = 0;
  await page.route('**/api/parent/email-preferences', route => {
    if (route.request().method() === 'POST') writes++;
    expect(route.request().headers()['x-fabelpad-parent']).toBe(parent.id);
    return route.fulfill({ status: 401, json: { error: 'account_changed', message: 'Het ouderaccount is gewijzigd. Laad je accountoverzicht opnieuw.' } });
  });
  await page.goto('/profiel/account');
  await expect(page.getByText('Het ouderaccount is gewijzigd. Laad je accountoverzicht opnieuw.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /promotionele e-mails/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'E-mailvoorkeur opslaan' })).toHaveCount(0);
  expect(writes).toBe(0);
});

test('returning to the page after an account switch hides the previously loaded preference', async ({ page }) => {
  let changed = false;
  await account(page, lifecycle, () => changed ? otherParent : parent);
  let writes = 0, readsAfterSwitch = 0;
  await page.route('**/api/parent/email-preferences', route => {
    expect(route.request().headers()['x-fabelpad-parent']).toBe(parent.id);
    if (route.request().method() === 'POST') writes++;
    if (changed) { readsAfterSwitch++; return route.fulfill({ status: 401, json: { error: 'account_changed', message: changedMessage } }); }
    return route.fulfill({ json: { marketingConsent: true, updatedAt: '2026-11-24T12:00:00Z' } });
  });
  await page.goto('/profiel/account');
  await expect(page.getByRole('checkbox', { name: /promotionele e-mails/ })).toBeChecked();
  changed = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /promotionele e-mails/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'E-mailvoorkeur opslaan', exact: true })).toHaveCount(0);
  expect(readsAfterSwitch).toBeGreaterThan(0); expect(writes).toBe(0);
});

test('a mutation rejected after a successful load removes the old parent preference form', async ({ page }) => {
  await account(page);
  let writes = 0;
  await page.route('**/api/parent/email-preferences', route => {
    expect(route.request().headers()['x-fabelpad-parent']).toBe(parent.id);
    if (route.request().method() === 'POST') { writes++; return route.fulfill({ status: 401, json: { error: 'account_changed', message: changedMessage } }); }
    return route.fulfill({ json: { marketingConsent: true, updatedAt: '2026-11-24T12:00:00Z' } });
  });
  await page.goto('/profiel/account');
  const checkbox = page.getByRole('checkbox', { name: /promotionele e-mails/ });
  await expect(checkbox).toBeChecked(); await checkbox.uncheck();
  await page.getByRole('button', { name: 'E-mailvoorkeur opslaan', exact: true }).click();
  await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();
  await expect(checkbox).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'E-mailvoorkeur opslaan', exact: true })).toHaveCount(0);
  await expect(page.getByText('Je toestemming is ingetrokken.', { exact: false })).toHaveCount(0);
  expect(writes).toBe(1);
});

test('a late preference read from A cannot replace the account mismatch found on a later focus', async ({ page }) => {
  let phase: 'initial' | 'pending-a' | 'changed' = 'initial';
  await account(page, lifecycle, () => phase === 'changed' ? otherParent : parent);
  let releaseA!: () => void;
  const pendingA = new Promise<void>(resolve => { releaseA = resolve; });
  let pendingRead = false, deliveredA = false;
  await page.route('**/api/parent/email-preferences', async route => {
    expect(route.request().method()).toBe('GET');
    expect(route.request().headers()['x-fabelpad-parent']).toBe(parent.id);
    if (phase === 'changed') { await route.fulfill({ status: 401, json: { error: 'account_changed', message: changedMessage } }); return; }
    if (phase === 'pending-a') {
      pendingRead = true; await pendingA;
      try { await route.fulfill({ json: { marketingConsent: true, updatedAt: '2026-11-24T12:00:00Z' } }); }
      catch { /* Aborting an old actor's browser request is expected. */ }
      deliveredA = true; return;
    }
    await route.fulfill({ json: { marketingConsent: true, updatedAt: '2026-11-24T12:00:00Z' } });
  });
  await page.goto('/profiel/account');
  await expect(page.getByRole('checkbox', { name: /promotionele e-mails/ })).toBeChecked();
  try {
    phase = 'pending-a'; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect.poll(() => pendingRead).toBe(true);
    phase = 'changed'; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();
    releaseA(); await expect.poll(() => deliveredA).toBe(true);
    await expect(page.getByRole('checkbox', { name: /promotionele e-mails/ })).toHaveCount(0);
    await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();
  } finally { releaseA(); }
});

test('a late successful write from A cannot restore a form or success notice after a focused account mismatch', async ({ page }) => {
  let changed = false;
  await account(page, lifecycle, () => changed ? otherParent : parent);
  let releaseA!: () => void;
  const pendingA = new Promise<void>(resolve => { releaseA = resolve; });
  let pendingWrite = false, deliveredA = false, writes = 0;
  await page.route('**/api/parent/email-preferences', async route => {
    expect(route.request().headers()['x-fabelpad-parent']).toBe(parent.id);
    if (route.request().method() === 'POST') {
      writes++; expect(route.request().postDataJSON()).toEqual({ marketingConsent: false });
      pendingWrite = true; await pendingA;
      try { await route.fulfill({ json: { marketingConsent: false, updatedAt: '2026-11-24T12:01:00Z' } }); }
      catch { /* Aborting an old actor's browser request is expected. */ }
      deliveredA = true; return;
    }
    await route.fulfill(changed ? { status: 401, json: { error: 'account_changed', message: changedMessage } } : { json: { marketingConsent: true, updatedAt: '2026-11-24T12:00:00Z' } });
  });
  await page.goto('/profiel/account');
  const checkbox = page.getByRole('checkbox', { name: /promotionele e-mails/ });
  await expect(checkbox).toBeChecked(); await checkbox.uncheck();
  try {
    await page.getByRole('button', { name: 'E-mailvoorkeur opslaan', exact: true }).click();
    await expect.poll(() => pendingWrite).toBe(true);
    changed = true; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();
    releaseA(); await expect.poll(() => deliveredA).toBe(true);
    await expect(checkbox).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'E-mailvoorkeur opslaan', exact: true })).toHaveCount(0);
    await expect(page.getByText('Je toestemming is ingetrokken.', { exact: false })).toHaveCount(0);
    await expect(page.getByText(changedMessage, { exact: true })).toBeVisible();
    expect(writes).toBe(1);
  } finally { releaseA(); }
});

test('an unavailable preference is not guessed and can be loaded again', async ({ page }) => {
  await account(page);
  let available = false;
  await page.route('**/api/parent/email-preferences', route => available
    ? route.fulfill({ json: { marketingConsent: true, updatedAt: '2026-11-24T12:00:00Z' } })
    : route.fulfill({ status: 503, json: { message: 'Je e-mailvoorkeur is tijdelijk niet bereikbaar.' } }));
  await page.goto('/profiel/account');
  await expect(page.getByText('Je e-mailvoorkeur is tijdelijk niet bereikbaar.')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /promotionele e-mails/ })).toHaveCount(0);
  available = true;
  await page.getByRole('button', { name: 'E-mailvoorkeur opnieuw ophalen' }).click();
  await expect(page.getByRole('checkbox', { name: /promotionele e-mails/ })).toBeChecked();
});

test('pending account deletion offers no way to subscribe to promotional email', async ({ page }) => {
  await account(page, { ...lifecycle, state: 'deletion_pending', deletionDeadline: '2026-12-24T12:00:00Z' });
  let requests = 0;
  await page.route('**/api/parent/email-preferences', route => { requests++; return route.fulfill({ json: { marketingConsent: false, updatedAt: null } }); });
  await page.goto('/profiel/account');
  await expect(page.getByRole('button', { name: 'Ik wil mijn account herstellen' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'E-mailvoorkeuren' })).toHaveCount(0);
  expect(requests).toBe(0);
});
