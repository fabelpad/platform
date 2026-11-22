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
  await page.goto('/bedrijfsgegevens');
  await expect(page.getByRole('main')).toContainText("Den Haag ('S-Gravenhage)");
  await expect(page.getByRole('main')).toContainText('88135713');
  await expect(page.getByRole('main')).not.toContainText('btw');
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
  await expect(page.getByText('Voorlezen kan met een geïnstalleerde offline Nederlandse stem. Lees ondertussen gezellig samen.')).toBeVisible();
  await page.locator('.reader-choice').first().click();
  await expect(page.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
});
