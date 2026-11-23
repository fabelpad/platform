import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import type { Family, FamilySnapshot } from '../../src/profileStorage';

const prefix = 'fabelpad-scope-prototype-demo::';
const familyKey = `${prefix}fabelpad-family`;
const normalize = (value: string) => value.replace(/\s+/gu, ' ').trim();
async function seed(page: Page, family: Family, prefs: Record<string, unknown> = {}) {
  await page.addInitScript(({ key, family, prefix, prefs }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(family));
    for (const child of family.children) if (!localStorage.getItem(`${prefix}fabelpad-child-${child.id}-prefs`)) localStorage.setItem(`${prefix}fabelpad-child-${child.id}-prefs`, JSON.stringify({ muted: true, calm: true, ...prefs }));
  }, { key: familyKey, family, prefix, prefs });
}
async function storedFamily(page: Page): Promise<Family> { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), familyKey); }
async function editLocal(page: Page, name: string) {
  await page.goto('/ouders');
  await expect(page.locator('.pd-shell,.local-parent-gate')).toBeVisible();
  if (await page.locator('#local-parent-answer').count()) { await page.locator('#local-parent-answer').fill('12'); await page.getByRole('button', { name: 'Naar de ouderomgeving', exact: true }).click(); }
  await page.getByRole('button', { name: `Profiel van ${name} bewerken`, exact: true }).click();
}
async function expectVariant(page: Page, request: APIRequestContext, level: string, name: string, picks = '') {
  const { release } = await (await request.get('/api/content/dream')).json();
  const expected = release.readingLevels[level].scenes[picks].text.replaceAll('__FABELPAD_CHILD__', name).replaceAll('{{naam}}', name).replace(/\bAvonturier\b/gu, name);
  await expect.poll(async () => normalize(await page.locator('.reader-story-text').innerText())).toBe(normalize(expected));
  await expect(page.locator('.reader-shell select,input[type=date]')).toHaveCount(0);
  await expect(page.locator('.reader-art-badge')).toHaveText(`Het avontuur van ${name}`);
}

test('new personal profile in the app requires a real non-future birth date behind the parent gate', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') });
  await page.goto('/lezen');
  await page.getByRole('button', { name: 'Kindprofiel kiezen', exact: true }).click();
  await page.getByRole('button', { name: /Nieuw kindprofiel/ }).click();
  await expect(page.locator('#child-birth-date')).toHaveCount(0);
  await page.locator('#parent-answer').fill('12');
  await page.getByRole('button', { name: 'Naar het ouderhoekje' }).click();
  await page.locator('#child-name').fill('Lotte');
  const birth = page.locator('#child-birth-date');
  await page.getByRole('button', { name: 'Dit wordt mijn wereld!' }).click();
  expect((await storedFamily(page)).children).toHaveLength(1);
  expect(await birth.evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  await birth.evaluate((input: HTMLInputElement) => { input.value = '2020-04-31'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await birth.inputValue()).toBe('');
  await birth.fill('2026-11-24');
  await page.getByRole('button', { name: 'Dit wordt mijn wereld!' }).click();
  expect((await storedFamily(page)).children).toHaveLength(1);
  expect(await birth.evaluate((input: HTMLInputElement) => input.validity.rangeOverflow)).toBe(true);
  await birth.fill('2020-02-29');
  await expect(page.locator('.profile-birth-date-display')).toHaveText('Geboortedatum: 29-02-2020');
  await page.getByRole('button', { name: 'Dit wordt mijn wereld!' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await storedFamily(page)).children.find(child => child.name === 'Lotte')).toMatchObject({ birthDate: '2020-02-29' });
  expect((await storedFamily(page)).children.find(child => child.name === 'Lotte')).not.toHaveProperty('readingLevelOverride');
});

test('profile switching and direct links use ages five, seven and nine while retaining each route', async ({ page, request }) => {
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') });
  const children = [{ id: 'young', name: 'Pip', avatar: 0, birthDate: '2021-11-23' }, { id: 'middle', name: 'Mila', avatar: 1, birthDate: '2019-11-23' }, { id: 'older', name: 'Bo', avatar: 2, birthDate: '2017-11-23' }];
  await seed(page, { version: 1, children, activeId: 'young' }, { readingLevel: '9plus' });
  await page.goto('/lezen?story=dream&readingLevel=9plus');
  await expectVariant(page, request, 'under6', 'Pip');
  await page.locator('.illustrated-choice-option').first().click();
  await expect(page.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
  for (const [name, level] of [['Mila', '6to8'], ['Bo', '9plus'], ['Pip', 'under6']]) {
    await page.getByRole('button', { name: 'Verhaal sluiten', exact: true }).click();
    await page.getByRole('button', { name: 'Kindprofiel kiezen', exact: true }).click();
    await page.getByRole('button', { name: `Verder als ${name}`, exact: true }).click();
    await page.getByRole('button', { name: 'Open De Droompost', exact: true }).click();
    await expectVariant(page, request, level, name, name === 'Pip' ? '0' : '');
  }
  await expect(page.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
});

test('manual profile override survives edits and reload until the parent explicitly restores automatic', async ({ page, request }) => {
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') });
  await seed(page, { version: 1, children: [{ id: 'mila', name: 'Mila', avatar: 1, birthDate: '2019-11-23' }], activeId: 'mila' });
  await editLocal(page, 'Mila');
  await expect(page.locator('#pd-profile-reading-level')).toHaveValue('auto');
  await page.locator('#pd-profile-reading-level').selectOption('9plus');
  await page.getByRole('button', { name: 'Profiel bewaren', exact: true }).click();
  await page.goto('/lezen?story=dream');
  await expectVariant(page, request, '9plus', 'Mila');
  await editLocal(page, 'Mila');
  await expect(page.locator('#pd-profile-reading-level')).toHaveValue('9plus');
  await page.locator('#pd-profile-birth-date').fill('2022-11-23');
  await page.getByRole('button', { name: 'Profiel bewaren', exact: true }).click();
  await page.goto('/lezen?story=dream');
  await expectVariant(page, request, '9plus', 'Mila');
  await editLocal(page, 'Mila');
  await page.getByRole('button', { name: 'Gebruik automatisch leesniveau', exact: true }).click();
  await page.getByRole('button', { name: 'Profiel bewaren', exact: true }).click();
  await page.goto('/lezen?story=dream&readingLevel=9plus');
  await expectVariant(page, request, 'under6', 'Mila');
  expect((await storedFamily(page)).children[0]).not.toHaveProperty('readingLevelOverride');
});

test('legacy profile keeps route when a date enables automatic, including downloaded variants and cached content', async ({ page, request }) => {
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') });
  await seed(page, { version: 1, children: [{ id: 'legacy', name: 'Noor', avatar: 0 }], activeId: 'legacy' }, { readingLevel: '9plus' });
  await page.goto('/lezen?story=dream');
  await expectVariant(page, request, '9plus', 'Noor');
  await page.locator('.illustrated-choice-option').first().click();
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${prefix}fabelpad-child-legacy-story-dream`);
  await editLocal(page, 'Noor');
  await page.getByRole('button', { name: 'Annuleren', exact: true }).click();
  await page.getByRole('button', { name: 'Voor onderweg', exact: true }).click();
  await page.getByRole('button', { name: 'De Droompost downloaden', exact: true }).click();
  await expect(page.getByRole('button', { name: 'De Droompost download verwijderen', exact: true })).toBeVisible();
  const downloaded = await page.evaluate(async () => { const cache = await caches.open('fabelpad-downloads-v1'); return (await (await cache.match('/art/download-dream.json'))!.json()).readingLevels; });
  expect(Object.keys(downloaded).sort()).toEqual(['6to8', '9plus', 'under6']);
  await page.getByRole('button', { name: 'Mijn gezin', exact: true }).click();
  await page.getByRole('button', { name: 'Profiel van Noor bewerken', exact: true }).click();
  await expect(page.getByLabel('Geboortedatum toevoegen', { exact: true })).toBeVisible();
  await page.locator('#pd-profile-birth-date').fill('2021-11-23');
  await page.getByRole('button', { name: 'Profiel bewaren', exact: true }).click();
  await page.route('**/api/content/dream*', route => route.abort());
  await page.goto('/lezen?story=dream&level=9plus');
  await expectVariant(page, request, 'under6', 'Noor', '0');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${prefix}fabelpad-child-legacy-story-dream`)).toEqual(before);
});

for (const [year, before, after] of [['2020', 'under6', '6to8'], ['2017', '6to8', '9plus']]) test(`an open session changes category on the ${year === '2020' ? 'sixth' : 'ninth'} Dutch midnight birthday and foreground resume`, async ({ page, request }) => {
  await page.clock.install({ time: new Date('2026-11-22T22:59:50Z') });
  await seed(page, { version: 1, children: [{ id: 'birthday', name: 'Sam', avatar: 0, birthDate: `${year}-11-23` }], activeId: 'birthday' });
  await page.goto('/lezen?story=dream');
  await expectVariant(page, request, before, 'Sam');
  await page.clock.fastForward(20_000);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expectVariant(page, request, after, 'Sam');
  await expect(page.getByText('Deel 1 van 5', { exact: true })).toBeVisible();
});

test('online onboarding saves the mandatory date and profile editing synchronizes a separate override', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-23T12:00:00Z') });
  const parent = { id: 'synthetic-birth-parent', email: 'parent@example.test', displayName: 'Ouder' };
  const active = { state: 'active', termsVersion: '2026-11-22', privacyVersion: '2026-11-23', acceptedTermsVersion: '2026-11-22', shownPrivacyVersion: '2026-11-23', lastActivityAt: '2026-11-23T12:00:00Z', deletionDeadline: null, consents: [] };
  let snapshot: FamilySnapshot | null = null;
  let uploads = 0, consents = 0;
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent, admin: false, lifecycle: active } }));
  await page.route('**/api/parent/status', route => route.fulfill({ json: active }));
  await page.route('**/api/parent/activity', route => route.fulfill({ json: { ok: true } }));
  await page.route('**/api/parent/consent', route => { consents++; return route.fulfill({ json: active }); });
  await page.route('**/api/family', route => {
    if (route.request().method() === 'PUT') { uploads++; snapshot = route.request().postDataJSON().snapshot; }
    return route.fulfill({ json: { parent, revision: uploads, snapshot } });
  });
  await page.goto('/gezin');
  await page.locator('#onboarding-child-name').fill('Noor');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Nieuw kindprofiel bewaren' }).click();
  expect(uploads).toBe(0); expect(consents).toBe(0);
  await page.locator('#onboarding-child-birth-date').fill('2019-11-23');
  await page.getByRole('button', { name: 'Nieuw kindprofiel bewaren' }).click();
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expect.poll(() => uploads).toBe(1);
  expect(snapshot!.family.children[0]).toMatchObject({ name: 'Noor', birthDate: '2019-11-23' });
  expect(snapshot!.family.children[0]).not.toHaveProperty('readingLevelOverride');
  await expect(page.locator('input[type=date]')).toHaveCount(0);
  await page.goto('/gezin?ouders=1');
  await page.getByRole('button', { name: 'Bewerken', exact: true }).click();
  await expect(page.locator('#family-profile-birth-date')).toHaveValue('2019-11-23');
  await page.locator('#family-profile-reading-level').selectOption('9plus');
  await page.getByRole('button', { name: 'Wijziging bewaren', exact: true }).click();
  await expect.poll(() => snapshot?.family.children[0].readingLevelOverride).toBe('9plus');
  await page.reload();
  await page.getByRole('button', { name: 'Bewerken', exact: true }).click();
  await expect(page.locator('#family-profile-reading-level')).toHaveValue('9plus');
  await page.getByRole('button', { name: 'Gebruik automatisch leesniveau', exact: true }).click();
  await page.getByRole('button', { name: 'Wijziging bewaren', exact: true }).click();
  await expect.poll(() => snapshot?.family.children[0].readingLevelOverride).toBeUndefined();
  expect(consents).toBe(1);
});

test('a local legacy profile needs its date before first online import and retains the same route', async ({ page }) => {
  const parent = { id: 'synthetic-import-parent', email: 'parent@example.test', displayName: 'Ouder' };
  const active = { state: 'active', termsVersion: '2026-11-22', privacyVersion: '2026-11-23', acceptedTermsVersion: '2026-11-22', shownPrivacyVersion: '2026-11-23', lastActivityAt: '2026-11-23T12:00:00Z', deletionDeadline: null, consents: [] };
  await seed(page, { version: 1, children: [{ id: 'legacy-import', name: 'Noor', avatar: 0 }], activeId: 'legacy-import' }, { readingLevel: '9plus' });
  await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({ picks: [1, 0], updatedAt: 1 })), `${prefix}fabelpad-child-legacy-import-story-dream`);
  let snapshot: FamilySnapshot | null = null, uploads = 0;
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent, admin: false, lifecycle: active } }));
  await page.route('**/api/parent/status', route => route.fulfill({ json: active }));
  await page.route('**/api/parent/consent', route => route.fulfill({ json: active }));
  await page.route('**/api/family', route => {
    if (route.request().method() === 'PUT') { uploads++; snapshot = route.request().postDataJSON().snapshot; }
    return route.fulfill({ json: { parent, revision: uploads, snapshot } });
  });
  await page.goto('/gezin');
  const preview = page.locator('.account-import-preview');
  await preview.getByRole('checkbox').check();
  const upload = page.getByRole('button', { name: 'Deze profielen online bewaren', exact: true });
  await expect(upload).toBeDisabled();
  expect(uploads).toBe(0);
  await preview.locator('input[type=date]').fill('2021-11-23');
  await expect(upload).toBeEnabled();
  await upload.click();
  await expect(page.locator('.world-card')).toHaveCount(13);
  expect(snapshot!.family.children[0]).toMatchObject({ id: 'legacy-import', birthDate: '2021-11-23' });
  expect(snapshot!.data['legacy-import']['story-dream']).toMatchObject({ picks: [1, 0] });
  expect(snapshot!.family.children[0]).not.toHaveProperty('readingLevelOverride');
});
