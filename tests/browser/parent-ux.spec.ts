import { test, expect, type Page } from '@playwright/test';
import type { FamilySnapshot } from '../../src/profileStorage';

const parent = { id: '00000000-0000-4000-8000-000000000601', email: 'parent@example.test', displayName: 'Voorbeeldouder' };
const lifecycle = { state: 'active', termsVersion: '2026-11-23.1', privacyVersion: '2026-11-24', acceptedTermsVersion: '2026-11-23.1', shownPrivacyVersion: '2026-11-23.1', lastActivityAt: '2026-11-23T12:00:00Z', deletionDeadline: null };
function fixture() {
  return { snapshot: { schemaVersion: 1, family: { version: 1, children: [{ id: 'noor', name: 'Noor', avatar: 1, birthDate: '2019-11-23' }, { id: 'mila', name: 'Mila', avatar: 2, birthDate: '2020-01-01' }], activeId: 'noor' }, data: { noor: { favorites: ['dream'] }, mila: { favorites: ['station'] } } } as FamilySnapshot, revision: 1, writes: 0, rejectWithdrawal: false, failReads: false, failAfterWithdrawal: false };
}
async function mock(page: Page, state: ReturnType<typeof fixture>, owner = parent) {
  const status = () => ({ ...lifecycle, consents: state.snapshot.family.children.map(child => ({ profileId: child.id, grantedAt: '2026-11-18T10:00:00Z', withdrawnAt: null, method: 'guardian_declaration' })) });
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent: owner, admin: false, lifecycle: status() } }));
  await page.route('**/api/parent/status', route => route.fulfill({ json: status() }));
  await page.route('**/api/parent/activity', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/parent/consent', route => {
    if (route.request().method() !== 'DELETE') return route.fulfill({ json: status() });
    if (state.rejectWithdrawal) return route.fulfill({ status: 503, json: { message: 'Intrekken lukt nu niet. Er is niets gewijzigd.' } });
    const id = route.request().postDataJSON().profileId;
    state.snapshot = { ...state.snapshot, family: { ...state.snapshot.family, children: state.snapshot.family.children.filter(child => child.id !== id), activeId: 'mila' }, data: Object.fromEntries(Object.entries(state.snapshot.data).filter(([key]) => key !== id)) };
    state.revision++; if (state.failAfterWithdrawal) state.failReads = true;
    return route.fulfill({ json: status() });
  });
  await page.route('**/api/family', route => {
    if (route.request().method() === 'PUT') { state.writes++; state.snapshot = route.request().postDataJSON().snapshot; state.revision++; }
    if (state.failReads) return route.fulfill({ status: 503, json: { message: 'Geen verbinding' } });
    return route.fulfill({ json: { parent: owner, revision: state.revision, snapshot: state.snapshot } });
  });
}

for (const width of [320, 390, 768, 1280]) test(`parent navigation and profile dialogs fit ${width}px with keyboard focus`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); const state = fixture(); await mock(page, state);
  await page.goto('/gezin?ouders=1');
  await expect(page.getByRole('heading', { name: 'Ons gezin', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Terug naar de verhalen', exact: true })).toHaveAttribute('href', '/gezin');
  await expect(page.getByText('Toestemming gegeven op', { exact: false }).first()).toBeVisible();
  await expect(page.locator('input[type=date]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (width < 860) {
    const menu = page.getByRole('button', { name: 'Menu', exact: true }); await menu.focus(); await menu.press('ArrowDown');
    const navigation = page.getByRole('navigation', { name: 'Mobiel oudermenu' });
    await expect(navigation.getByRole('link', { name: 'Mijn gezin' })).toBeFocused();
    await expect(navigation.getByRole('link', { name: 'Mijn gezin' })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape'); await expect(menu).toBeFocused(); await expect(menu).toHaveAttribute('aria-expanded', 'false');
    await menu.click(); await page.mouse.click(4, 220); await expect(menu).toHaveAttribute('aria-expanded', 'false');
  } else await expect(page.getByRole('navigation', { name: 'Ouderomgeving' }).getByRole('link', { name: 'Mijn gezin' })).toHaveAttribute('aria-current', 'page');
  const edit = page.getByRole('button', { name: 'Bewerken van Noor', exact: true }); await edit.click();
  const dialog = page.getByRole('dialog', { name: 'Profiel van Noor' }); await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Bijnaam aanpassen' })).toHaveAttribute('maxlength', '20');
  await expect(page.locator('#family-profile-birth-date')).toHaveValue('2019-11-23');
  expect(await dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(edit).toBeFocused();
  expect(state.writes).toBe(0);
  if (width === 390) await page.screenshot({ path: '/tmp/fabelpad-parent-ux-web390.png', fullPage: true });
});

test('withdrawal needs confirmation, keeps confirmed state on failure and never reuploads after a failed server reload', async ({ page }) => {
  const state = fixture(); state.rejectWithdrawal = true; await mock(page, state);
  await page.addInitScript(() => localStorage.setItem('fabelpad-scope-parent%3Aother::fabelpad-family', 'other-family-preserved'));
  await page.goto('/gezin?ouders=1');
  await page.getByRole('button', { name: 'Bewerken van Noor', exact: true }).click();
  await page.getByRole('button', { name: 'Toestemming intrekken', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Trek toestemming in en wis dit profiel' });
  await expect(page.getByText('Andere profielen blijven bestaan.', { exact: false })).toBeVisible();
  await confirm.click(); await expect(page.getByRole('dialog').getByText('Intrekken lukt nu niet. Er is niets gewijzigd.')).toBeVisible();
  expect(state.snapshot.family.children.map(child => child.name)).toEqual(['Noor', 'Mila']);
  state.rejectWithdrawal = false; state.failAfterWithdrawal = true; await confirm.click();
  await expect(page.getByRole('dialog')).toHaveCount(0); await expect(page.getByText('Noor', { exact: true })).toHaveCount(0); await expect(page.getByText('Mila', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Toevoegen', exact: true })).toBeDisabled();
  const draft = await page.evaluate(id => JSON.parse(localStorage.getItem(`fabelpad-cloud-draft-${encodeURIComponent(id)}`)!), parent.id);
  expect(JSON.stringify(draft)).not.toContain('Noor'); expect(JSON.stringify(draft)).toContain('Mila'); expect(state.writes).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem('fabelpad-scope-parent%3Aother::fabelpad-family'))).toBe('other-family-preserved');
  state.failReads = false; await page.getByRole('button', { name: 'Bevestigde gezinsgegevens opnieuw ophalen' }).click();
  await expect(page.getByRole('button', { name: 'Toevoegen', exact: true })).toBeEnabled();
  await page.reload(); await expect(page.getByText('Mila', { exact: true })).toBeVisible(); await expect(page.getByText('Noor', { exact: true })).toHaveCount(0); expect(state.writes).toBe(0);
});

test('profile changes reach a second device and another parent remains isolated', async ({ page, browser }) => {
  const state = fixture(); await mock(page, state); await page.goto('/gezin?ouders=1');
  const secondContext = await browser.newContext(); const second = await secondContext.newPage(); await mock(second, state); await second.goto('/gezin?ouders=1');
  await page.getByRole('button', { name: 'Bewerken van Noor', exact: true }).click(); await page.getByRole('textbox', { name: 'Bijnaam aanpassen' }).fill('Nova'); await page.getByRole('button', { name: 'Wijziging bewaren', exact: true }).click();
  await expect.poll(() => state.writes).toBe(1); await second.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(second.getByText('Nova', { exact: true })).toBeVisible();
  const other = fixture(); other.snapshot.family.children = [{ id: 'other-child', name: 'Ander gezin', avatar: 0 }]; other.snapshot.family.activeId = 'other-child'; other.snapshot.data = { 'other-child': {} };
  const otherContext = await browser.newContext(); const otherPage = await otherContext.newPage(); await mock(otherPage, other, { ...parent, id: '00000000-0000-4000-8000-000000000602', email: 'other@example.test' }); await otherPage.goto('/gezin?ouders=1');
  await expect(otherPage.getByText('Ander gezin', { exact: true })).toBeVisible(); await expect(otherPage.getByText('Nova', { exact: true })).toHaveCount(0); await expect(otherPage.getByText('Mila', { exact: true })).toHaveCount(0);
  await secondContext.close(); await otherContext.close();
});

test('account presents actual synchronization, export and subscription access at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 }); const state = fixture(); await mock(page, state); await page.goto('/profiel/account');
  for (const heading of ['Accountgegevens', 'Synchronisatie', 'Privacy en toegang', 'Gezinsabonnement']) await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect(page.getByText(parent.email, { exact: true })).toBeVisible(); await expect(page.getByText('Avonturen bewaard', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nu bijwerken', exact: true }).click(); await expect(page.getByText('De gezinsgegevens zijn bijgewerkt.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Abonnement bekijken', exact: true })).toHaveAttribute('href', '/profiel/abonnement');
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Gezinsgegevens downloaden', exact: true }).click(); expect((await download).suggestedFilename()).toBe('fabelpad-gezinsgegevens.json');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/fabelpad-parent-ux-account390.png', fullPage: true });
});
