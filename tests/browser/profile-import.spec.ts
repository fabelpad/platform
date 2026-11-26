import { test, expect, type Page } from '@playwright/test';
import type { FamilySnapshot } from '../../src/profileStorage';

const parent = { id: '00000000-0000-4000-8000-000000000811', email: 'parent@example.test', displayName: 'Voorbeeldouder' };
const active = { state: 'active', termsVersion: '2026-11-23.1', privacyVersion: '2026-11-24', acceptedTermsVersion: '2026-11-23.1', shownPrivacyVersion: '2026-11-23.1', lastActivityAt: '2026-11-23T12:00:00Z', deletionDeadline: null, consents: [] };
const source: FamilySnapshot = {
  schemaVersion: 1,
  family: { version: 1, children: [{ id: 'used-adventurer', name: 'Avonturier', avatar: 2, readingLevelOverride: '9plus' }], activeId: 'used-adventurer' },
  data: { 'used-adventurer': {
    prefs: { muted: true, calm: false, readingLevel: '6to8' }, favorites: ['dream'], started: ['station'],
    completed: { dream: { ending: 'De sterrenpost', date: '2026-11-22' } },
    'story-station': { picks: [1, 0], updatedAt: 1790000000000 }, memory: { dream: { favorite: 'sterren' } },
  } },
};
const prefix = `fabelpad-scope-${encodeURIComponent(`parent:${parent.id}`)}::`;

function fixture() { return { snapshot: null as FamilySnapshot | null, revision: 0, uploads: [] as FamilySnapshot[], consents: [] as string[], withdrawn: [] as string[], rejectedConsents: 0, reads: 0, emptySnapshot: false, failPut: false, loseResponse: false, conflicts: 0, blocked: false, holdConsent: null as Promise<void> | null }; }
async function mock(page: Page, state: ReturnType<typeof fixture>, local: FamilySnapshot | null = source) {
  if (local) await page.addInitScript(snapshot => {
    if (localStorage.getItem('fabelpad-family')) return;
    localStorage.setItem('fabelpad-family', JSON.stringify(snapshot.family));
    for (const [id, fields] of Object.entries(snapshot.data)) for (const [field, value] of Object.entries(fields)) localStorage.setItem(`fabelpad-child-${id}-${field}`, JSON.stringify(value));
  }, local);
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent, admin: false, lifecycle: active } }));
  await page.route('**/api/parent/status', route => route.fulfill({ json: active }));
  await page.route('**/api/parent/activity', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/parent/consent', async route => {
    const id = route.request().postDataJSON().profileId as string;
    if (route.request().method() === 'DELETE') {
      state.withdrawn.push(id);
      const children = state.snapshot!.family.children.filter(child => child.id !== id);
      state.snapshot = { ...state.snapshot!, family: { ...state.snapshot!.family, children, activeId: children[0]?.id ?? '' }, data: Object.fromEntries(Object.entries(state.snapshot!.data).filter(([key]) => key !== id)) };
      state.revision++;
      return route.fulfill({ json: active });
    }
    if (state.withdrawn.includes(id)) { state.rejectedConsents++; return route.fulfill({ status: 403, json: { error: 'profile_withdrawn', message: 'Een ingetrokken profiel kan niet opnieuw worden gebruikt.' } }); }
    state.consents.push(id);
    if (state.holdConsent) await state.holdConsent;
    await route.fulfill({ json: active });
  });
  await page.route('**/api/family', route => {
    state.reads++;
    if (state.blocked) return route.fulfill({ status: 401, json: { error: 'not_authenticated' } });
    if (route.request().method() === 'PUT') {
      const submitted = route.request().postDataJSON().snapshot as FamilySnapshot;
      state.uploads.push(structuredClone(submitted));
      if (route.request().postDataJSON().baseRevision !== state.revision) { state.conflicts++; return route.fulfill({ status: 409, json: { revision: state.revision, snapshot: state.snapshot } }); }
      if (state.loseResponse) { state.loseResponse = false; state.snapshot = submitted; state.revision++; return route.fulfill({ status: 503, json: { message: 'Antwoord verloren na bewaren' } }); }
      if (state.failPut) return route.fulfill({ status: 503, json: { message: 'Tijdelijk onbereikbaar' } });
      state.snapshot = submitted; state.revision++;
    }
    return route.fulfill({ json: { parent, revision: state.revision, snapshot: state.snapshot ?? (state.emptySnapshot ? { schemaVersion: 1, family: { version: 1, children: [], activeId: '' }, data: {} } : null) } });
  });
}

for (const width of [320, 390]) test(`used Avonturier has one editable profile form at ${width}px and imports every reading field`, async ({ page }) => {
  const state = fixture(); await mock(page, state); await page.setViewportSize({ width, height: 844 }); await page.goto('/gezin');
  await expect(page.getByRole('radio', { name: 'Profielen van dit apparaat meenemen', exact: true })).toBeChecked();
  await expect(page.locator('input[type=date]')).toHaveCount(1);
  await expect(page.locator('#onboarding-child-name')).toHaveCount(0);
  const name = page.getByLabel('Voornaam of bijnaam van profiel 1', { exact: true });
  await expect(name).toHaveValue('Avonturier'); await name.focus();
  expect(await name.evaluate((input: HTMLInputElement) => [input.selectionStart, input.selectionEnd])).toEqual([0, 10]);
  await name.fill('Lotte'); await page.locator('#import-used-adventurer-birth-date').fill('2020-02-29');
  await page.locator('.account-import-preview').getByRole('checkbox').check();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const bounds = await name.boundingBox(); const container = await page.locator('.account-import-preview').boundingBox();
  expect(bounds!.width).toBeGreaterThan(container!.width - 40);
  await page.screenshot({ path: `/tmp/fabelpad-profile-import-${width}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Deze profielen online bewaren', exact: true }).click();
  await expect(page.locator('.world-card')).toHaveCount(13);
  expect(state.consents).toEqual(['used-adventurer']); expect(state.uploads).toHaveLength(1);
  expect(state.snapshot!.family.children[0]).toEqual({ ...source.family.children[0], name: 'Lotte', birthDate: '2020-02-29' });
  expect(state.snapshot!.data).toEqual(source.data);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fabelpad-family')!))).toEqual(source.family);
});

for (const initialFlow of ['import', 'new'] as const) test(`a completed ${initialFlow} starts a fresh consent and profile ID after withdrawing the last child without remounting`, async ({ page }) => {
  const state = fixture(); const local = structuredClone(source); local.family.children[0].birthDate = '2019-11-23';
  await mock(page, state, initialFlow === 'import' ? local : null); await page.goto('/gezin');
  const documentToken = await page.evaluate(() => { const token = crypto.randomUUID(); Object.assign(window, { profileSetupDocument: token }); return token; });
  if (initialFlow === 'import') {
    await expect(page.locator('#import-used-adventurer-birth-date')).toHaveValue('2019-11-23');
    await page.locator('#import-used-adventurer-name').fill('Noor'); await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Deze profielen online bewaren', exact: true }).click();
  } else {
    await page.locator('#onboarding-child-name').fill('Noor'); await page.locator('#onboarding-child-birth-date').fill('2019-11-23');
    await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Nieuw kindprofiel bewaren', exact: true }).click();
  }
  await expect(page.locator('.world-card')).toHaveCount(13);
  const firstId = state.snapshot!.family.children[0].id;
  await page.getByRole('button', { name: 'Voor ouders', exact: true }).first().click();
  await page.locator('#parent-answer').fill('12'); await page.getByRole('button', { name: 'Naar het ouderhoekje' }).click();
  await page.getByRole('button', { name: 'Bewerken', exact: true }).click();
  await page.getByRole('button', { name: 'Toestemming intrekken', exact: true }).click();
  await page.getByRole('button', { name: 'Trek toestemming in en wis dit profiel', exact: true }).click();
  await expect(page.locator('#onboarding-child-name')).toBeVisible();
  await expect(page.locator('#onboarding-child-name')).toHaveValue(''); await expect(page.locator('#onboarding-child-birth-date')).toHaveValue('');
  await expect(page.getByRole('checkbox')).not.toBeChecked(); await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nieuw kindprofiel bewaren', exact: true })).toBeDisabled();
  expect(state.snapshot!.family.children).toEqual([]); expect(state.uploads).toHaveLength(1); expect(state.consents).toEqual([firstId]);
  expect(await page.evaluate(() => (window as Window & { profileSetupDocument?: string }).profileSetupDocument)).toBe(documentToken);
  const reads = state.reads; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect.poll(() => state.reads).toBeGreaterThan(reads);
  await expect(page.locator('#onboarding-child-name')).toHaveValue(''); await expect(page.getByRole('checkbox')).not.toBeChecked();
  await page.locator('#onboarding-child-name').fill('Mila'); await page.locator('#onboarding-child-birth-date').fill('2021-01-01');
  await expect(page.getByRole('button', { name: 'Nieuw kindprofiel bewaren', exact: true })).toBeDisabled();
  await page.getByRole('checkbox').check(); await page.getByRole('button', { name: 'Nieuw kindprofiel bewaren', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ons gezin', exact: true })).toBeVisible(); await expect(page.getByText('Mila', { exact: true })).toBeVisible();
  expect(state.snapshot!.family.children[0].id).not.toBe(firstId); expect(state.uploads).toHaveLength(2);
  expect(state.consents).toEqual([firstId, state.snapshot!.family.children[0].id]); expect(state.withdrawn).toEqual([firstId]); expect(state.rejectedConsents).toBe(0);
  if (initialFlow === 'import') expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fabelpad-family')!))).toEqual(local.family);
});

test('an unused default profile offers only the new profile form', async ({ page }) => {
  const state = fixture(); const unused = structuredClone(source); unused.data = { 'used-adventurer': { prefs: { muted: true, calm: false } } };
  await mock(page, state, unused); await page.goto('/gezin');
  await expect(page.locator('#onboarding-child-name')).toBeVisible();
  await expect(page.locator('input[type=date]')).toHaveCount(1);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.locator('.account-import-preview')).toHaveCount(0);
  expect(state.consents).toEqual([]); expect(state.uploads).toEqual([]);
});

test('switching flow keeps separate drafts and consents and an empty refresh preserves the import edits', async ({ page }) => {
  const state = fixture(); await mock(page, state); await page.goto('/gezin');
  await page.getByLabel('Voornaam of bijnaam van profiel 1', { exact: true }).fill('Noor');
  await page.locator('#import-used-adventurer-birth-date').fill('2019-11-23');
  await page.locator('.account-import-preview').getByRole('checkbox').check();
  const reads = state.reads; state.emptySnapshot = true; state.revision++;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => state.reads).toBeGreaterThan(reads);
  await expect(page.getByLabel('Voornaam of bijnaam van profiel 1', { exact: true })).toHaveValue('Noor');
  await page.getByRole('radio', { name: 'Een nieuw kindprofiel maken', exact: true }).check();
  await expect(page.locator('.account-import-preview')).toHaveCount(0); await expect(page.locator('input[type=date]')).toHaveCount(1);
  await page.locator('#onboarding-child-name').fill('Mila'); await page.locator('#onboarding-child-birth-date').fill('2021-01-01');
  await expect(page.getByRole('checkbox')).not.toBeChecked(); await expect(page.getByRole('button', { name: 'Nieuw kindprofiel bewaren' })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('radio', { name: 'Profielen van dit apparaat meenemen', exact: true }).check();
  await expect(page.locator('#import-used-adventurer-name')).toHaveValue('Noor'); await expect(page.locator('#import-used-adventurer-birth-date')).toHaveValue('2019-11-23');
  await expect(page.locator('.account-import-preview').getByRole('checkbox')).toBeChecked();
  await page.getByRole('radio', { name: 'Een nieuw kindprofiel maken', exact: true }).check();
  await expect(page.locator('#onboarding-child-name')).toHaveValue('Mila');
  await page.getByRole('button', { name: 'Nieuw kindprofiel bewaren' }).click(); await expect(page.locator('.world-card')).toHaveCount(13);
  expect(state.consents).toEqual([state.snapshot!.family.children[0].id]); expect(state.consents[0]).not.toBe('used-adventurer');
  expect(state.snapshot!.family.children).toHaveLength(1); expect(state.snapshot!.family.children[0].name).toBe('Mila');
  expect(await page.evaluate(() => localStorage.getItem('fabelpad-device-import-owner'))).toBeNull();
});

test('failed import can retry with the same profile IDs and leaves the device source intact', async ({ page }) => {
  const state = fixture(); state.failPut = true; await mock(page, state); await page.goto('/gezin');
  await page.locator('#import-used-adventurer-birth-date').fill('2020-01-01'); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Deze profielen online bewaren' }).click();
  await expect(page.getByText('Toestemming is bewaard, maar het profiel is nog niet veilig opgeslagen. Probeer het opnieuw.')).toBeVisible();
  const first = structuredClone(state.uploads[0]);
  expect(await page.evaluate(() => localStorage.getItem('fabelpad-device-import-owner'))).toBeNull();
  state.failPut = false; await page.getByRole('button', { name: 'Deze profielen online bewaren' }).click();
  await expect(page.locator('.world-card')).toHaveCount(13); expect(state.snapshot).toEqual(first);
  expect(state.uploads).toHaveLength(2); expect(state.uploads[1]).toEqual(first);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fabelpad-family')!))).toEqual(source.family);
});

test('an unresolved import cannot switch to a replacement profile and a background retry adopts the saved family', async ({ page }) => {
  const state = fixture(); state.failPut = true; await mock(page, state); await page.goto('/gezin');
  await page.locator('#import-used-adventurer-birth-date').fill('2020-01-01'); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Deze profielen online bewaren' }).click();
  await expect(page.getByText('Toestemming is bewaard, maar het profiel is nog niet veilig opgeslagen. Probeer het opnieuw.')).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Een nieuw kindprofiel maken', exact: true })).toBeDisabled();
  state.failPut = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => state.snapshot?.family.children[0].id).toBe('used-adventurer');
  await expect(page.locator('.world-card')).toHaveCount(13);
  expect(state.snapshot!.family.children).toHaveLength(1); expect(state.snapshot!.data).toEqual(source.data);
  await expect(page.locator('#onboarding-child-name')).toHaveCount(0);
});

test('a committed import with a lost response recovers through 409 without replacing its profiles', async ({ page }) => {
  const state = fixture(); state.loseResponse = true; await mock(page, state); await page.goto('/gezin');
  await page.locator('#import-used-adventurer-birth-date').fill('2020-01-01'); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Deze profielen online bewaren' }).click();
  await expect(page.getByText('Toestemming is bewaard, maar het profiel is nog niet veilig opgeslagen. Probeer het opnieuw.')).toBeVisible();
  await expect(page.locator('#import-used-adventurer-name')).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Een nieuw kindprofiel maken', exact: true })).toBeDisabled();
  const saved = structuredClone(state.snapshot); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('.world-card')).toHaveCount(13); expect(state.conflicts).toBe(1);
  expect(state.snapshot).toEqual(saved); expect(state.uploads[1]).toEqual(state.uploads[0]);
});

test('a different confirmed family opens the existing conflict choice without silently replacing it', async ({ page }) => {
  const state = fixture(); state.failPut = true; await mock(page, state); await page.goto('/gezin');
  await page.locator('#import-used-adventurer-birth-date').fill('2020-01-01'); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Deze profielen online bewaren' }).click();
  await expect(page.getByText('Toestemming is bewaard, maar het profiel is nog niet veilig opgeslagen. Probeer het opnieuw.')).toBeVisible();
  const remote: FamilySnapshot = { schemaVersion: 1, family: { version: 1, children: [{ id: 'other-device', name: 'Mila', avatar: 1, birthDate: '2021-01-01' }], activeId: 'other-device' }, data: { 'other-device': { favorites: ['station'] } } };
  state.failPut = false; state.snapshot = structuredClone(remote); state.revision++;
  await page.getByRole('button', { name: 'Deze profielen online bewaren' }).click();
  await expect(page.getByRole('dialog', { name: 'Er is ook op een ander apparaat verder gelezen.' })).toBeVisible();
  expect(state.snapshot).toEqual(remote);
  await page.getByRole('button', { name: 'De nieuwste opgeslagen versie ophalen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); expect(state.snapshot).toEqual(remote);
  expect(await page.evaluate(() => localStorage.getItem('fabelpad-device-import-owner'))).toBeNull();
});

test('a late consent after session loss stops the second profile and cannot hydrate or reopen the family', async ({ page }) => {
  const state = fixture(); const two = structuredClone(source);
  two.family.children.push({ id: 'sibling', name: 'Mila', avatar: 1 }); two.data.sibling = {};
  let release!: () => void; state.holdConsent = new Promise<void>(resolve => { release = resolve; });
  await mock(page, state, two); await page.goto('/gezin');
  await expect(page.locator('input[type=date]')).toHaveCount(2);
  for (const date of await page.locator('input[type=date]').all()) await date.fill('2020-01-01');
  for (const consent of await page.getByRole('checkbox').all()) await consent.check();
  await page.getByRole('button', { name: 'Deze profielen online bewaren' }).click(); await expect.poll(() => state.consents.length).toBe(1);
  await expect(page.locator('#import-used-adventurer-name')).toBeDisabled();
  await expect(page.getByRole('radio', { name: 'Een nieuw kindprofiel maken' })).toBeDisabled();
  state.blocked = true; await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByRole('heading', { name: 'Even geen verbinding met jullie verhalen.' })).toBeVisible();
  const response = page.waitForResponse('**/api/parent/consent'); release(); await response; await page.waitForTimeout(100);
  expect(state.consents).toEqual(['used-adventurer']); expect(state.uploads).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), `${prefix}fabelpad-family`)).toBeNull();
  expect(await page.evaluate(key => localStorage.getItem(key), `fabelpad-import-pending-${parent.id}`)).toBeNull();
  await expect(page.locator('.world-card')).toHaveCount(0);
});

test('choosing the confirmed empty family discards the unresolved setup and releases the profile choice', async ({ page }) => {
  const state = fixture(); state.failPut = true; await mock(page, state); await page.goto('/gezin');
  await page.locator('#import-used-adventurer-birth-date').fill('2020-01-01'); await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Deze profielen online bewaren' }).click();
  await expect(page.getByText('Toestemming is bewaard, maar het profiel is nog niet veilig opgeslagen. Probeer het opnieuw.')).toBeVisible();
  state.failPut = false; state.revision++; state.snapshot = { schemaVersion: 1, family: { version: 1, children: [], activeId: '' }, data: {} };
  await page.getByRole('button', { name: 'Deze profielen online bewaren' }).click();
  await expect(page.getByRole('dialog', { name: 'Er is ook op een ander apparaat verder gelezen.' })).toBeVisible();
  await page.getByRole('button', { name: 'De nieuwste opgeslagen versie ophalen' }).click();
  await expect(page.getByRole('radio', { name: 'Een nieuw kindprofiel maken', exact: true })).toBeEnabled();
  await page.getByRole('radio', { name: 'Een nieuw kindprofiel maken', exact: true }).check();
  await expect(page.locator('#onboarding-child-name')).toBeEnabled(); await expect(page.locator('#onboarding-child-name')).toHaveValue('');
  await expect(page.getByRole('checkbox')).not.toBeChecked(); expect(state.snapshot.family.children).toEqual([]);
  expect(await page.evaluate(key => localStorage.getItem(key), `fabelpad-import-pending-${parent.id}`)).toBeNull();
});
