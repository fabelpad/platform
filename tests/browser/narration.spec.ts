import { test, expect, chromium, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { DEFAULT_NAME_CATALOGUE, DEFAULT_NAME_CUES, DEFAULT_NARRATION_PRESETS, NARRATION_FORMAT, type NarrationCuePack, type NarrationManifest } from '../../lib/narration/contracts';

const prefix = 'fabelpad-scope-prototype-demo::';
const profile = 'narration-synthetic-child';
const privateName = 'Geheime Testnaam';
const bytes = (id: string) => Buffer.from(`deterministic-audio:${id}`);
const asset = (id: string) => ({ id, sha256: createHash('sha256').update(bytes(id)).digest('hex'), byteLength: bytes(id).length, durationMs: 1000, mimeType: 'audio/wav' as const });
const pack: NarrationCuePack = { schemaVersion: 1, packId: 'public-test-pack', packVersion: 1, locale: 'nl-NL', voiceSlot: 'stem-1', presetVersion: 1, catalogue: DEFAULT_NAME_CATALOGUE, cues: DEFAULT_NAME_CUES, fallbackNameId: 'avonturier', variants: Object.fromEntries(DEFAULT_NAME_CUES.map(cue => [cue.id, { avonturier: { nl: 'cue-generic' }, 'n-noor': { nl: 'cue-noor' } }])), assets: { 'cue-generic': { ...asset('cue-generic'), base64: bytes('cue-generic').toString('base64') }, 'cue-noor': { ...asset('cue-noor'), base64: bytes('cue-noor').toString('base64') } } };
function manifest(url: string): NarrationManifest {
  const params = new URL(url).searchParams;
  const plain = (id: string) => [{ kind: 'asset' as const, asset: id }];
  return { schemaVersion: 1, storyId: params.get('storyId')!, contentVersion: params.get('version')!, sourceFingerprint: 'fixture-only', audioRevision: 1, locale: 'nl-NL', readingLevel: params.get('readingLevel') as '9plus', access: { scope: 'full', offlineUntil: null }, voice: { slotId: 'stem-1', presetVersion: 1, label: 'Warme verteller' }, format: NARRATION_FORMAT, cuePack: { packId: pack.packId, packVersion: 1, voicePresetVersion: 1, lookup: 'device' }, assets: Object.fromEntries(['begin', 'tail', 'cue-generic', 'choice-0', 'choice-1', 'next-0', 'next-1'].map(id => [id, asset(id)])), scenes: { '': { segments: [...plain('begin'), { kind: 'nameCue', cueId: 'kom-mee', fallbackAsset: 'cue-generic' }, ...plain('tail')], choices: [0, 1].map(choiceIndex => ({ choiceIndex, segments: plain(`choice-${choiceIndex}`) })) }, '0': { segments: plain('next-0'), choices: [] }, '1': { segments: plain('next-1'), choices: [] } }, endings: {} };
}
async function seed(page: Page, name = privateName) {
  await page.addInitScript(({ prefix, profile, name }) => {
    if (!localStorage.getItem(`${prefix}fabelpad-family`)) localStorage.setItem(`${prefix}fabelpad-family`, JSON.stringify({ version: 1, children: [{ id: profile, name, avatar: 0 }], activeId: profile }));
    if (!localStorage.getItem(`${prefix}fabelpad-child-${profile}-prefs`)) localStorage.setItem(`${prefix}fabelpad-child-${profile}-prefs`, JSON.stringify({ muted: false, calm: true, readingLevel: '9plus', voiceSlot: 'stem-1' }));
  }, { prefix, profile, name });
}
async function fixtureApi(page: Page) {
  const requests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/voorlezen/')) requests.push(request.url()); });
  await page.route('**/api/voorlezen/voices', route => route.fulfill({ json: { schemaVersion: 1, environment: 'fixture', available: true, active: true, defaultVoiceSlot: 'stem-1', voices: DEFAULT_NARRATION_PRESETS } }));
  await page.route('**/api/voorlezen/name-pack?**', route => route.fulfill({ json: pack }));
  await page.route('**/api/voorlezen/manifest?**', route => route.fulfill({ json: { manifest: manifest(route.request().url()) } }));
  await page.route('**/api/voorlezen/assets/*?**', route => { const id = new URL(route.request().url()).pathname.split('/').pop()!; return route.fulfill({ contentType: 'audio/wav', body: bytes(id) }); });
  return requests;
}
async function mockAudio(page: Page) {
  await page.addInitScript(() => {
    const blobs = new Map<string, Blob>(); const realCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = value => { const url = realCreate(value); if (value instanceof Blob) blobs.set(url, value); return url; };
    const calls = { clips: [] as string[], pauses: 0, instances: [] as unknown[], finish: () => {} };
    class AudioFixture {
      src = ''; preload = ''; onended: (() => void) | null = null; onerror: (() => void) | null = null;
      constructor(source = '') { this.src = source; calls.instances.push(this); calls.finish = () => this.onended?.(); }
      async play() { const value = blobs.get(this.src); calls.clips.push(value ? await value.text() : this.src); }
      pause() { calls.pauses++; }
      removeAttribute(key: string) { if (key === 'src') this.src = ''; }
    }
    Object.defineProperty(window, 'Audio', { configurable: true, value: AudioFixture });
    Object.defineProperty(window, '__narrationAudio', { value: calls });
  });
}
const clips = (page: Page) => page.evaluate(() => (window as unknown as { __narrationAudio: { clips: string[] } }).__narrationAudio.clips);
const finishClip = (page: Page) => page.evaluate(() => (window as unknown as { __narrationAudio: { finish: () => void } }).__narrationAudio.finish());
async function localChoice(page: Page, choice: Record<string, unknown>, childId = profile) {
  await page.evaluate(async ({ choice, childId }) => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('fabelpad-device-narration-v1', 1);
      request.onupgradeneeded = () => { for (const store of ['settings', 'recordings']) request.result.createObjectStore(store, { keyPath: 'id' }); request.result.createObjectStore('epochs'); };
      request.onsuccess = () => { const db = request.result; const tx = db.transaction(['settings', 'recordings'], 'readwrite'); const scope = 'fabelpad-scope-prototype-demo'; tx.objectStore('settings').put({ id: `${scope}:${childId}`, scope, profileId: childId, choice }); tx.objectStore('recordings').put({ id: `${scope}:${childId}:cue:kom-mee`, scope, profileId: childId, cueId: 'kom-mee', blob: new Blob(['local parent recording'], { type: 'audio/webm' }) }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(new Error('fixture storage failed')); };
    });
  }, { choice, childId });
}

test('generated reader preserves cue order, chooses names locally, pauses and resumes the current clip', async ({ page }) => {
  await seed(page); const requests = await fixtureApi(page); await mockAudio(page);
  await page.goto('/lezen?story=dream'); await expect(page.getByText('AI-voorleesstem · Warme verteller', { exact: true })).toBeVisible();
  await localChoice(page, { mode: 'name', catalogueId: 'n-noor', pronunciationId: 'nl' });
  await page.getByRole('button', { name: 'Lees voor', exact: true }).click();
  await expect.poll(() => clips(page)).toEqual(['deterministic-audio:begin']);
  await page.getByRole('button', { name: 'Even pauzeren', exact: true }).click(); await page.getByRole('button', { name: 'Verder luisteren', exact: true }).click();
  await expect.poll(() => clips(page)).toEqual(['deterministic-audio:begin', 'deterministic-audio:begin']);
  await finishClip(page); await expect.poll(() => clips(page)).toEqual(['deterministic-audio:begin', 'deterministic-audio:begin', 'deterministic-audio:cue-noor']);
  await finishClip(page); await expect.poll(() => clips(page)).toHaveLength(4); expect((await clips(page))[3]).toBe('deterministic-audio:tail');
  await finishClip(page); await expect(page.getByRole('button', { name: 'Lees voor', exact: true })).toBeVisible();
  expect(requests.filter(url => url.includes('/name-pack?'))).toHaveLength(1);
  expect(requests.every(url => !url.includes('noor') && !decodeURIComponent(url).includes(privateName) && !url.includes(profile))).toBe(true);
});

test('choice previews keep their index and a route change cancels the old clip', async ({ page }) => {
  await seed(page); await fixtureApi(page); await mockAudio(page);
  await page.goto('/lezen?story=dream'); await expect(page.getByText('AI-voorleesstem · Warme verteller', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Keuze 2 beluisteren', exact: true }).click(); await expect.poll(() => clips(page)).toEqual(['deterministic-audio:choice-1']);
  await page.locator('.illustrated-choice-option').last().click(); await expect(page.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Lees voor', exact: true }).click(); await expect.poll(() => clips(page)).toEqual(['deterministic-audio:choice-1', 'deterministic-audio:next-1']);
  await page.getByRole('button', { name: 'Verhaal sluiten', exact: true }).click(); await expect(page.locator('.reader-shell')).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __narrationAudio: { pauses: number } }).__narrationAudio.pauses)).toBeGreaterThan(0);
});

test('late audio delivery cannot start after a route change', async ({ page }) => {
  await seed(page); await fixtureApi(page); await mockAudio(page); let release: (() => void) | null = null;
  await page.route('**/api/voorlezen/assets/begin?**', async route => { await new Promise<void>(resolve => { release = resolve; }); await route.fulfill({ contentType: 'audio/wav', body: bytes('begin') }).catch(() => {}); });
  await page.goto('/lezen?story=dream'); await expect(page.getByText('AI-voorleesstem · Warme verteller', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Lees voor', exact: true }).click();
  await expect.poll(() => !!release).toBe(true); await page.locator('.illustrated-choice-option').first().click(); await expect(page.getByText('Deel 2 van 5', { exact: true })).toBeVisible(); release!();
  await page.waitForTimeout(150); expect(await clips(page)).toEqual([]);
  await page.getByRole('button', { name: 'Lees voor', exact: true }).click(); await expect.poll(() => clips(page)).toEqual(['deterministic-audio:next-0']);
});

test('continuous listening resumes the selected route and scope revocation stops the chain', async ({ page }) => {
  await seed(page); await fixtureApi(page); await mockAudio(page);
  await page.goto('/lezen?story=dream'); await expect(page.getByText('AI-voorleesstem · Warme verteller', { exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Na mijn keuze verder voorlezen', exact: true }).check(); await page.getByRole('button', { name: 'Lees voor', exact: true }).click(); await expect.poll(() => clips(page)).toEqual(['deterministic-audio:begin']);
  await page.locator('.illustrated-choice-option').last().click(); await expect.poll(() => clips(page)).toEqual(['deterministic-audio:begin', 'deterministic-audio:next-1']);
  await page.evaluate(() => window.dispatchEvent(new Event('fabelpad-storage-scope-change'))); await expect(page.getByRole('button', { name: 'Lees voor', exact: true })).toBeVisible(); await finishClip(page); expect(await clips(page)).toHaveLength(2);
});

test('an invalid asset checksum uses only the generic local Dutch fallback', async ({ page }) => {
  await seed(page); await fixtureApi(page); await mockAudio(page);
  await page.addInitScript(() => {
    const utterances: string[] = []; Object.defineProperty(window, '__narrationLocalFallback', { value: utterances });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { text: string; constructor(text: string) { this.text = text; } } });
    Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [{ lang: 'nl-NL', localService: true, name: 'Synthetic local voice' }], addEventListener() {}, removeEventListener() {}, cancel() {}, speak(value: { text: string }) { utterances.push(value.text); } } });
  });
  await page.route('**/api/voorlezen/assets/begin?**', route => route.fulfill({ contentType: 'audio/wav', body: bytes('wrong') }));
  await page.goto('/lezen?story=dream'); await expect(page.getByText('AI-voorleesstem · Warme verteller', { exact: true })).toBeVisible(); await page.getByRole('button', { name: 'Lees voor', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __narrationLocalFallback: string[] }).__narrationLocalFallback.length)).toBe(1);
  const spoken = await page.evaluate(() => (window as unknown as { __narrationLocalFallback: string[] }).__narrationLocalFallback[0]); expect(spoken).not.toContain(privateName); expect(spoken).toContain('Avonturier'); expect(await clips(page)).toEqual([]);
});

test('missing personal recording falls back to Avonturier in the selected voice without a name request', async ({ page }) => {
  await seed(page); const requests = await fixtureApi(page); await mockAudio(page);
  await page.goto('/lezen?story=dream'); await expect(page.getByText('AI-voorleesstem · Warme verteller', { exact: true })).toBeVisible();
  await localChoice(page, { mode: 'recording' });
  await page.evaluate(async () => { const request = indexedDB.open('fabelpad-device-narration-v1', 1); await new Promise<void>(resolve => { request.onsuccess = () => { const db = request.result; const tx = db.transaction('recordings', 'readwrite'); tx.objectStore('recordings').clear(); tx.oncomplete = () => { db.close(); resolve(); }; }; }); });
  await page.getByRole('button', { name: 'Lees voor', exact: true }).click(); await expect.poll(() => clips(page)).toHaveLength(1); await finishClip(page);
  await expect.poll(() => clips(page)).toEqual(['deterministic-audio:begin', 'deterministic-audio:cue-generic']);
  expect(requests.filter(url => url.includes('cue-'))).toHaveLength(0);
});

test('a local parent recording is inserted as a complete local cue and never uploaded', async ({ page }) => {
  await seed(page); const requests = await fixtureApi(page); await mockAudio(page); const writes: string[] = []; page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.goto('/lezen?story=dream'); await expect(page.getByText('AI-voorleesstem · Warme verteller', { exact: true })).toBeVisible(); await localChoice(page, { mode: 'recording' });
  await page.getByRole('button', { name: 'Lees voor', exact: true }).click(); await expect.poll(() => clips(page)).toHaveLength(1); await finishClip(page); await expect.poll(() => clips(page)).toEqual(['deterministic-audio:begin', 'local parent recording']);
  expect(writes).toEqual([]); expect(requests.every(url => !url.includes('recording') && !url.includes(profile))).toBe(true);
});

test('profile settings expose five voices and keep name searches and pronunciation choices outside the family snapshot', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); await seed(page); const requests = await fixtureApi(page);
  await page.goto('/ouders'); await expect(page.locator('.pd-shell,.local-parent-gate')).toBeVisible(); if (await page.locator('#local-parent-answer').count()) { await page.locator('#local-parent-answer').fill('12'); await page.getByRole('button', { name: 'Naar de ouderomgeving', exact: true }).click(); }
  await page.getByRole('button', { name: 'Leesinstellingen', exact: true }).click(); const panel = page.locator('.narration-profile'); await expect(panel.getByRole('radio')).toHaveCount(5);
  await panel.getByRole('radio').nth(3).check();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).voiceSlot, `${prefix}fabelpad-child-${profile}-prefs`)).toBe('stem-4');
  await panel.getByRole('radio').first().check(); await panel.getByRole('combobox', { name: 'Naam bij het luisteren', exact: true }).selectOption('name'); await panel.getByLabel('Zoek een beschikbare naam').fill('  NOOR ');
  await expect(panel.getByText('Beschikbaar: Noor.', { exact: true })).toBeVisible(); await panel.getByRole('button', { name: 'Deze uitspraak op dit apparaat gebruiken', exact: true }).click(); await expect(panel.getByText('Lokale keuze: Noor.', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('narration-profile-390.png'), fullPage: true });
  const prefs = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${prefix}fabelpad-child-${profile}-prefs`);
  expect(prefs).toMatchObject({ voiceSlot: 'stem-1' }); expect(Object.keys(prefs).sort()).toEqual(['calm', 'muted', 'readingLevel', 'voiceSlot']);
  expect(requests.every(url => !url.toLowerCase().includes('noor') && !url.includes(profile))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.getByRole('button', { name: 'Wis lokale naamkeuze en alle ouderopnamen', exact: true }).click(); await expect(panel.getByText('Alle lokale naamkeuzes en ouderopnamen voor dit profiel zijn gewist.', { exact: true })).toBeVisible();
});

test('removing one local profile deletes only its personal cue data', async ({ page }) => {
  await seed(page); await fixtureApi(page); await page.goto('/lezen'); await localChoice(page, { mode: 'recording' }); await localChoice(page, { mode: 'alias', catalogueId: 'a-dappere-vos' }, 'other-synthetic-child');
  await page.evaluate(({ prefix, profile }) => { localStorage.setItem(`${prefix}fabelpad-family`, JSON.stringify({ version: 1, children: [{ id: profile, name: 'Geheime Testnaam', avatar: 0 }, { id: 'other-synthetic-child', name: 'Andere avonturier', avatar: 1 }], activeId: profile })); }, { prefix, profile });
  await page.goto('/ouders'); await expect(page.locator('.pd-shell,.local-parent-gate')).toBeVisible(); if (await page.locator('#local-parent-answer').count()) { await page.locator('#local-parent-answer').fill('12'); await page.getByRole('button', { name: 'Naar de ouderomgeving', exact: true }).click(); }
  await page.getByRole('button', { name: `Profiel van ${privateName} bewerken`, exact: true }).click(); await page.getByRole('button', { name: 'Profiel verwijderen', exact: true }).click(); await page.getByRole('button', { name: 'Ja, lokaal verwijderen', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => { const request = indexedDB.open('fabelpad-device-narration-v1', 1); return new Promise<string[]>(resolve => { request.onsuccess = () => { const db = request.result; const rows = db.transaction('settings').objectStore('settings').getAll(); rows.onsuccess = () => { db.close(); resolve(rows.result.map(row => row.profileId)); }; }; }); })).toEqual(['other-synthetic-child']);
});

test('a cold account deletion page purges personal recordings before any reader or voice settings open', async ({ page }) => {
  const removedParent = '11111111-1111-4111-8111-111111111111';
  await page.goto('/privacy');
  await page.evaluate(async removedParent => {
    const request = indexedDB.open('fabelpad-device-narration-v1', 1);
    await new Promise<void>((resolve, reject) => {
      request.onupgradeneeded = () => { for (const store of ['settings', 'recordings']) request.result.createObjectStore(store, { keyPath: 'id' }); request.result.createObjectStore('epochs'); };
      request.onsuccess = () => { const db = request.result; const tx = db.transaction(['settings', 'recordings'], 'readwrite'); for (const parentId of [removedParent, '22222222-2222-4222-8222-222222222222']) { const scope = `fabelpad-scope-${encodeURIComponent(`parent:${parentId}`)}`; const profileId = 'synthetic-account-child'; const id = `${scope}:${profileId}`; tx.objectStore('settings').put({ id, scope, profileId, choice: { mode: 'recording' } }); tx.objectStore('recordings').put({ id: `${id}:cue:kom-mee`, scope, profileId, cueId: 'kom-mee', blob: new Blob(['private parent recording'], { type: 'audio/webm' }) }); } tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(new Error('fixture storage failed')); };
    });
  }, removedParent);
  await page.route('**/api/auth/session', route => route.fulfill({ status: 410, json: { error: 'account_deleted', cleanupParentId: removedParent, message: 'Dit synthetische account is verwijderd.' } }));
  // Full document navigation resets the module graph. No narration UI has run.
  await page.goto('/inloggen'); await expect(page.getByText('Dit synthetische account is verwijderd.', { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => { const request = indexedDB.open('fabelpad-device-narration-v1', 1); return new Promise<string[]>(resolve => { request.onsuccess = () => { const db = request.result; const rows = db.transaction('recordings').objectStore('recordings').getAll(); rows.onsuccess = () => { db.close(); resolve(rows.result.map(row => row.scope)); }; }; }); })).toEqual(['fabelpad-scope-parent%3A22222222-2222-4222-8222-222222222222']);
});

const administrator = { id: '11111111-1111-4111-8111-111111111111', email: 'narration-admin@example.test', displayName: 'Beheerder' };
const lifecycle = { state: 'active', termsVersion: '2026-11-22', privacyVersion: '2026-11-23', acceptedTermsVersion: '2026-11-22', shownPrivacyVersion: '2026-11-23', consents: [] };
function adminFixture() { return { environment: 'staging', revision: 1, keyConfigured: false, lastTestAt: null, lastTestResult: null, supportedModels: ['gpt-realtime-2.1-mini', 'gpt-realtime-2.1'], settings: { generationEnabled: false, playbackEnabled: false, defaultVoiceSlot: 'stem-1', model: 'gpt-realtime-2.1-mini', styleVersion: 1, budgetCents: 0, maxParallel: 1, slots: structuredClone(DEFAULT_NARRATION_PRESETS), cueCatalogue: structuredClone(DEFAULT_NAME_CATALOGUE) }, workerHealth: { state: 'awaiting_configuration', lastTickAt: null }, queue: [] as Record<string, unknown>[], coverage: { expectedCombinations: 15, publishedCombinations: 0, missingItems: 25, uniqueAssets: 0 }, usage: { reservedCents: 0, actualCents: 0, unknownAttempts: 0 } }; }
test('administration remains usable without a key, clears write-only key input and presents the cost plan before enqueue', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 }); const status = adminFixture(); const actions: { path: string; body: Record<string, unknown> }[] = [];
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent: administrator, admin: true, lifecycle } }));
  await page.route('**/api/admin/voorlezen**', route => {
    const request = route.request(); const path = new URL(request.url()).pathname; expect(request.headers()['x-fabelpad-parent']).toBe(administrator.id);
    if (request.method() === 'GET') return route.fulfill({ json: status });
    const body = request.postDataJSON(); actions.push({ path, body }); expect(body.baseRevision).toBe(status.revision);
    if (request.method() === 'PUT') { status.settings = body.settings; status.keyConfigured = !!body.apiKey; status.revision++; return route.fulfill({ json: { saved: true } }); }
    if (path.endsWith('/plan')) return route.fulfill({ json: { planId: 'synthetic-plan', stories: 1, expectedItems: 25, uniqueItems: 21, estimatedMinutes: 5.5, estimatedCents: 40, estimateComplete: true } });
    return route.fulfill({ json: { queued: true } });
  });
  await page.goto('/studio/voorlezen'); await expect(page.getByText('Wacht op OpenAI-koppeling', { exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Verbinding testen', exact: true })).toBeDisabled();
  const key = page.locator('#narration-provider-key'); await key.fill('sk-proj-synthetic-write-only-fixture'); await page.getByRole('button', { name: 'Koppeling en instellingen bewaren', exact: true }).click(); await expect(key).toHaveValue(''); await expect(page.getByText('Sleutel ingesteld', { exact: true })).toBeVisible();
  expect(actions[0].body.apiKey).toBe('sk-proj-synthetic-write-only-fixture'); expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('sk-proj-synthetic');
  await page.getByRole('button', { name: 'Stemmen', exact: true }).click(); await expect(page.locator('.narration-voice-admin-list article')).toHaveCount(5);
  await page.getByRole('button', { name: 'Audiowachtrij', exact: true }).click(); await page.getByRole('button', { name: 'Catalogusplan en kostenraming maken', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Plan ter bevestiging', exact: true })).toBeVisible(); expect(actions.some(value => value.path.endsWith('/enqueue'))).toBe(false);
  await page.screenshot({ path: testInfo.outputPath('narration-admin-390.png'), fullPage: true });
  await page.getByRole('button', { name: 'Dit catalogusplan inplannen', exact: true }).click(); await expect.poll(() => actions.find(value => value.path.endsWith('/enqueue'))?.body.planId).toBe('synthetic-plan');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('fragment approval requires explicit listening and transcript decisions and sends the exact item identity', async ({ page }) => {
  const status = adminFixture(); status.keyConfigured = true; status.queue = [{ id: 'job-synthetic', storyId: 'dream', contentVersion: '1234567890abcdef', sourceKind: 'release', state: 'review', expectedItems: 1, completedItems: 1, reviewItems: 1, attempt: 1, createdAt: '2026-11-23T12:00:00Z' }];
  let reviewed: Record<string, unknown> | null = null;
  const detail = { jobId: 'job-synthetic', items: [{ id: 'fragment-synthetic', readingLevel: '6to8', voiceSlot: 'stem-3', kind: 'choice', route: '010', choiceIndex: 1, state: 'review', expectedText: 'Open de groene deur.', transcript: 'Open de groene deur.', previewUrl: '/api/admin/voorlezen/assets/synthetic' }] };
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent: administrator, admin: true, lifecycle } }));
  await page.route('**/api/admin/voorlezen**', route => { const request = route.request(); if (request.method() === 'GET') return route.fulfill({ json: { ...status, detail } }); reviewed = request.postDataJSON(); return route.fulfill({ json: { reviewed: true } }); });
  await page.goto('/studio/voorlezen?jobId=job-synthetic&storyId=dream'); await page.getByRole('combobox', { name: 'Fragment en verhaalpad', exact: true }).selectOption('fragment-synthetic');
  const approve = page.getByRole('button', { name: 'Fragment goedkeuren', exact: true }); await expect(approve).toBeDisabled();
  await page.getByLabel('Ik heb de opname beluisterd en uitspraak, tempo en volume gecontroleerd.', { exact: true }).check(); await expect(approve).toBeDisabled();
  await page.getByLabel('Ik heb de volledige transcriptie met de redactionele tekst vergeleken.', { exact: true }).check(); await approve.click();
  await expect.poll(() => reviewed).toMatchObject({ baseRevision: 1, jobId: 'job-synthetic', itemId: 'fragment-synthetic', decision: 'approve', listened: true, transcriptChecked: true });
});

test('a changed administrator clears a pending provider key and rejects late administration state', async ({ page }) => {
  let parent = administrator; let release: (() => void) | null = null; let mutations = 0; const status = adminFixture();
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent, admin: true, lifecycle } }));
  await page.route('**/api/admin/voorlezen**', async route => { if (route.request().method() === 'GET') return route.fulfill({ json: status }); mutations++; expect(route.request().headers()['x-fabelpad-parent']).toBe(administrator.id); await new Promise<void>(resolve => { release = resolve; }); return route.fulfill({ json: { saved: true } }); });
  await page.goto('/studio/voorlezen'); await page.locator('#narration-provider-key').fill('sk-proj-pending-synthetic-private-key'); await page.getByRole('button', { name: 'Koppeling en instellingen bewaren', exact: true }).click(); await expect.poll(() => !!release).toBe(true);
  parent = { ...administrator, id: '22222222-2222-4222-8222-222222222222' }; await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(page.getByRole('link', { name: 'Inloggen voor beheer', exact: true })).toBeVisible(); release!();
  await page.waitForTimeout(100); await expect(page.locator('#narration-provider-key')).toHaveCount(0); expect(mutations).toBe(1); expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain('sk-proj-pending');
});

test('the actual browser microphone policy permits parent-initiated local recording and explicit deletion', async ({ baseURL }) => {
  const browser = await chromium.launch({ ...(process.env.FABELPAD_CHROMIUM_PATH ? { executablePath: process.env.FABELPAD_CHROMIUM_PATH } : {}), args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const context = await browser.newContext({ baseURL, permissions: ['microphone'], viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await seed(page); await fixtureApi(page); const writes: string[] = []; page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
    await page.goto('/ouders'); await expect(page.locator('.pd-shell,.local-parent-gate')).toBeVisible(); if (await page.locator('#local-parent-answer').count()) { await page.locator('#local-parent-answer').fill('12'); await page.getByRole('button', { name: 'Naar de ouderomgeving', exact: true }).click(); }
    await page.getByRole('button', { name: 'Leesinstellingen', exact: true }).click();
    expect(await page.evaluate(() => (document as unknown as { featurePolicy: { allowsFeature: (feature: string) => boolean } }).featurePolicy.allowsFeature('microphone'))).toBe(true);
    await page.getByRole('combobox', { name: 'Naam bij het luisteren', exact: true }).selectOption('recording'); await page.getByRole('button', { name: 'Zin inspreken', exact: true }).first().click();
    await expect(page.getByRole('button', { name: 'Opname stoppen', exact: true })).toBeVisible(); await page.waitForTimeout(450); await page.getByRole('button', { name: 'Opname stoppen', exact: true }).click();
    const save = page.getByRole('button', { name: 'Opname bewaren', exact: true }).first(); await expect(save).toBeEnabled(); await save.click(); await expect(page.getByRole('button', { name: 'Opnieuw inspreken', exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'Wissen', exact: true }).first().click(); await expect(page.getByRole('button', { name: 'Opnieuw inspreken', exact: true })).toHaveCount(0); expect(writes).toEqual([]);
  } finally { await context.close(); await browser.close(); }
});
