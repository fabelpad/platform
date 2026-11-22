import { test, expect, type Page } from '@playwright/test';
import type { FamilySnapshot } from '../../src/profileStorage';

const parent = { id: 'synthetic-family-jsonb', email: 'parent@example.test', displayName: 'Testouder' };
const active = { state: 'active', termsVersion: '2026-11-22', privacyVersion: '2026-11-22.1', acceptedTermsVersion: '2026-11-22', shownPrivacyVersion: '2026-11-22.1', lastActivityAt: '2026-11-22T12:00:00Z', deletionDeadline: null, consents: [] };
// PostgreSQL JSONB serializes object keys by length and then byte order. Their
// order is immaterial; profile arrays and story-choice arrays stay ordered.
function jsonbOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(jsonbOrder);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).map(([key, item]) => [key, jsonbOrder(item)]));
  return value;
}
async function session(page: Page) {
  await page.route('**/api/auth/session', route => route.fulfill({ json: { configured: true, parent, admin: false, providers: { email: true, google: true }, lifecycle: active } }));
  await page.route('**/api/parent/status', route => route.fulfill({ json: active }));
  await page.route('**/api/parent/activity', route => route.fulfill({ json: { ok: true } }));
}

test('local reading offers real parent login while keeping existing device profiles', async ({ page }) => {
  const profile = { version: 1, children: [{ id: 'child-device-existing', name: 'Avonturier', avatar: 2 }], activeId: 'child-device-existing' };
  await page.addInitScript(saved => localStorage.setItem('fabelpad-scope-prototype-demo::fabelpad-family', JSON.stringify(saved)), profile);
  await page.goto('/lezen');
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expect(page.getByRole('link', { name: 'Inloggen als ouder' }).first()).toHaveAttribute('href', '/inloggen');
  await expect(page.getByRole('button', { name: /Demo inloggen|Demo uitloggen/ })).toHaveCount(0);
  await expect(page.getByText('Op dit apparaat', { exact: true })).toBeVisible();
  const retained = await page.evaluate(() => JSON.parse(localStorage.getItem('fabelpad-scope-prototype-demo::fabelpad-family')!));
  expect(retained).toEqual(profile);
});

test('first consented profile accepts the PostgreSQL response and reopens without another profile or consent', async ({ page }) => {
  await session(page);
  let uploads = 0, consents = 0;
  let snapshot: FamilySnapshot | null = null;
  await page.route('**/api/parent/consent', route => { consents++; return route.fulfill({ json: active }); });
  await page.route('**/api/family', route => {
    if (route.request().method() === 'PUT') { uploads++; snapshot = route.request().postDataJSON().snapshot; }
    return route.fulfill({ json: jsonbOrder({ parent, revision: uploads, snapshot }) });
  });
  await page.goto('/gezin');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Start met een nieuw profiel Avonturier' }).click();
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expect(page.getByText('Avonturen bewaard', { exact: true })).toBeVisible();
  expect(uploads).toBe(1); expect(consents).toBe(1);
  const original = structuredClone(snapshot);
  await page.reload();
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expect(page.getByText('Avonturen bewaard', { exact: true })).toBeVisible();
  expect(uploads).toBe(1); expect(consents).toBe(1); expect(snapshot).toEqual(original);
});

test('a profile saved before the response bug is recovered from a stale dirty draft without another consent or PUT', async ({ page }) => {
  await session(page);
  const snapshot: FamilySnapshot = { schemaVersion: 1, family: { version: 1, children: [{ id: 'child-already-saved', name: 'Avonturier', avatar: 0 }], activeId: 'child-already-saved' }, data: { 'child-already-saved': {} } };
  await page.addInitScript(({ parentId, saved }) => localStorage.setItem(`fabelpad-cloud-draft-${encodeURIComponent(parentId)}`, JSON.stringify({ owner: parentId, revision: 0, snapshot: saved, dirty: true, baseSnapshot: null })), { parentId: parent.id, saved: snapshot });
  let uploads = 0, consents = 0;
  await page.route('**/api/parent/consent', route => { consents++; return route.fulfill({ status: 500, json: {} }); });
  await page.route('**/api/family', route => {
    if (route.request().method() === 'PUT') uploads++;
    return route.fulfill({ json: jsonbOrder({ parent, revision: 1, snapshot }) });
  });
  await page.goto('/gezin');
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expect(page.getByText('Avonturen bewaard', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start met een nieuw profiel Avonturier' })).toHaveCount(0);
  expect(uploads).toBe(0); expect(consents).toBe(0);
  const draft = await page.evaluate(parentId => JSON.parse(localStorage.getItem(`fabelpad-cloud-draft-${encodeURIComponent(parentId)}`)!), parent.id);
  expect(draft.dirty).toBe(false); expect(draft.revision).toBe(1); expect(draft.snapshot).toEqual(snapshot);
});
