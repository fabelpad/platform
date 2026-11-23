import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';

const pages = [
  ['/algemene-voorwaarden', 'Algemene voorwaarden Fabelpad'],
  ['/privacyverklaring', 'Privacyverklaring Fabelpad'],
  ['/privacy', 'Privacyverklaring Fabelpad'],
  ['/bedrijfsgegevens', 'Gegevens over DG Webservices'],
  ['/privacy-voor-kinderen', 'Jouw gegevens, jouw verhaal'],
  ['/account-verwijderen', 'Account en gegevens verwijderen'],
  ['/privacyverzoek', 'Een privacyverzoek indienen'],
  ['/herroepen', 'Koop ongedaan maken'],
] as const;

test('legal pages are public, readable on a phone and match their versioned downloads', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [url, heading] of pages) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
  const manifest = await (await request.get('/legal/2026-11-22/manifest.json')).json();
  for (const entry of Object.values(manifest) as { filename: string; sha256: string; version: string }[]) {
    const response = await request.get(`/legal/2026-11-22/${entry.filename}`);
    expect(response.status()).toBe(200);
    expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(entry.sha256);
    expect(entry.version).toBe('2026-11-22');
  }
  const latestManifest = await (await request.get('/legal/2026-11-23.1/manifest.json')).json();
  expect(Object.keys(latestManifest)).toEqual(['terms', 'privacy']);
  const currentDownload = await request.get('/legal/2026-11-23.1/privacyverklaring.md');
  expect(currentDownload.status()).toBe(200);
  expect(createHash('sha256').update(await currentDownload.body()).digest('hex')).toBe(latestManifest.privacy.sha256);
  expect(latestManifest.privacy.version).toBe('2026-11-23.1');
  await page.goto('/privacyverklaring');
  await expect(page.getByText('Versie 2026-11-23.1', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Deze versie als tekst bewaren' })).toHaveAttribute('href', '/legal/2026-11-23.1/privacyverklaring.md');
  await expect(page.getByRole('main')).toContainText('Stackmail');
  await expect(page.getByRole('main')).toContainText('geboortedatum');
  await expect(page.getByRole('main')).toContainText('uiterlijk na 180 dagen');
  await expect(page.getByRole('main')).toContainText('maximaal twaalf maanden na afsluiting');
  await expect(page.getByRole('main')).toContainText('staat momenteel uit');
  await page.goto('/bedrijfsgegevens');
  await expect(page.getByRole('main')).toContainText("Den Haag ('S-Gravenhage)");
  await expect(page.getByRole('main')).toContainText('88135713');
  await expect(page.getByRole('main')).not.toContainText('btw');
});

test('historical privacy links preserve exact old bytes and reject ambiguous versions', async ({ page, request }) => {
  for (const route of ['/privacyverklaring', '/privacy']) {
    const historical = await request.get(`${route}?versie=2026-11-22`, { maxRedirects: 0 });
    expect(historical.status()).toBe(307);
    const location = historical.headers().location;
    expect(new URL(location, historical.url()).pathname).toBe('/legal/2026-11-22/privacyverklaring.md');
    const oldDocument = await request.get(location);
    expect(oldDocument.status()).toBe(200);
    expect(createHash('sha256').update(await oldDocument.body()).digest('hex')).toBe('97673d3103443115097def26e20e6c677650dcb760d095de900ae3c5c5961cb7');
    const intermediate = await request.get(`${route}?versie=2026-11-22.1`, { maxRedirects: 0 });
    expect(intermediate.status()).toBe(307);
    expect(new URL(intermediate.headers().location, intermediate.url()).pathname).toBe('/legal/2026-11-22.1/privacyverklaring.md');
    const intermediateDocument = await request.get(intermediate.headers().location);
    expect(intermediateDocument.status()).toBe(200);
    expect(createHash('sha256').update(await intermediateDocument.body()).digest('hex')).toBe('c3f6186be703dda5320b70227070fea79e395eac225dbbbde0420913c57727e4');
    const current = await request.get(`${route}?versie=2026-11-23.1`);
    expect(current.status()).toBe(200);
    expect(current.headers()['content-type']).toContain('text/html');
    await page.goto(`${route}?versie=2026-11-23.1`);
    await expect(page.getByText('Versie 2026-11-23.1', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Deze versie als tekst bewaren' })).toHaveAttribute('href', '/legal/2026-11-23.1/privacyverklaring.md');
    expect((await request.get(`${route}?versie=not-a-version`)).status()).toBe(404);
    expect((await request.get(`${route}?versie=2026-11-22&versie=2026-11-22.1`)).status()).toBe(404);
  }
});

test('a twelve-year-old can prepare a privacy request without login or server submission', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') posts.push(request.url()); });
  await page.goto('/privacyverzoek');
  await expect(page.getByRole('link', { name: 'support@fabelpad.nl', exact: true }).first()).toHaveAttribute('href', /^mailto:support@fabelpad.nl/);
  await page.getByLabel('Wie doet het verzoek?').selectOption({ label: 'Ik ben 12 jaar en vraag over mijn eigen gegevens' });
  await page.getByLabel('Wat wil je vragen?').selectOption('intrekken');
  await page.getByRole('textbox').fill('Ik wil de toestemming voor mijn eigen profiel intrekken.');
  await page.getByRole('button', { name: 'Bericht openen in mijn e-mailprogramma' }).click();
  await expect(page.getByRole('status')).toContainText('Fabelpad heeft je verzoek pas ontvangen nadat je de e-mail hebt verstuurd.');
  expect(posts).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('toestemming voor mijn eigen profiel');
  await page.goto('/account-verwijderen');
  await expect(page.getByRole('link', { name: 'Gegevens eerder laten wissen', exact: true })).toHaveAttribute('href', '/privacyverzoek?type=verwijderen');
  await expect(page.getByRole('main')).toContainText('zonder een vaste wachttijd van 30 dagen');
});

test('web reading fails closed when only an online Dutch voice is available', async ({ page }) => {
  await page.addInitScript(() => {
    const onlineVoice = { lang: 'nl-NL', localService: false, name: 'Synthetic online Dutch voice' };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { getVoices: () => [onlineVoice], addEventListener: () => {}, removeEventListener: () => {}, cancel: () => {}, speak: () => { throw new Error('An online voice must never be used.'); } } });
  });
  await page.goto('/lezen?story=dream');
  await expect(page.getByRole('dialog', { name: /Droompost/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lees gezellig samen', exact: true })).toBeDisabled();
  await expect(page.getByText('De nieuwe voorleesstemmen zijn voor deze versie nog niet beschikbaar. Voorlezen kan ook met een geïnstalleerde offline Nederlandse stem. Lees ondertussen gezellig samen.')).toBeVisible();
  await page.locator('.illustrated-choice-option').first().click();
  await expect(page.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
});
