import { test, expect, type Page } from '@playwright/test';
import { worlds } from '../../src/worlds';

const prefix = 'fabelpad-scope-prototype-demo::';
const profile = 'child-complete-adventures';
const childKey = `${prefix}fabelpad-child-${profile}-`;
type StoredStory = { picks: number[]; revision: number; contentVersion: string; lastCompletedPicks?: number[]; lastCompletedContentVersion?: string };

async function syntheticProfile(page: Page, options: { large?: boolean; world?: string; picks?: number[]; level?: string; version?: string; release?: unknown } = {}) {
  await page.addInitScript(({ prefix, profile, options }) => {
    const base = `${prefix}fabelpad-child-${profile}-`;
    if (!localStorage.getItem(`${prefix}fabelpad-family`)) localStorage.setItem(`${prefix}fabelpad-family`, JSON.stringify({ version: 1, children: [{ id: profile, name: 'Avonturier', avatar: 0 }], activeId: profile }));
    if (!localStorage.getItem(`${base}prefs`)) localStorage.setItem(`${base}prefs`, JSON.stringify({ muted: true, calm: true, ...(options.large ? { textSize: 'large' } : {}), ...(options.level ? { readingLevel: options.level } : {}) }));
    if (options.world && options.picks && !localStorage.getItem(`${base}story-${options.world}`)) localStorage.setItem(`${base}story-${options.world}`, JSON.stringify({ picks: options.picks, revision: options.picks.length, updatedAt: 1, storyId: options.world, ...(options.version ? { contentVersion: options.version } : {}) }));
    if (options.world && options.version && options.release) localStorage.setItem(`fabelpad-content-v1:${options.world}:${options.version}`, JSON.stringify(options.release));
  }, { prefix, profile, options });
}
async function stored(page: Page, world: string): Promise<StoredStory> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), `${childKey}story-${world}`);
}
async function loadedImage(page: Page, selector: string) {
  await expect(page.locator(selector)).toBeVisible();
  await expect.poll(() => page.locator(selector).evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
}

for (const [storyIndex, world] of worlds.entries()) test(`${world.id}: all five heroes and play scenes, two equivalent choices and the fifth-choice ending`, async ({ page }) => {
  await syntheticProfile(page);
  await page.setViewportSize({ width: storyIndex % 2 ? 390 : 768, height: 900 });
  await page.goto(`/lezen?story=${world.id}`);
  await expect(page.locator('.reader-shell select')).toHaveCount(0);
  const picks: number[] = [];
  for (let chapter = 0; chapter < 5; chapter++) {
    await expect(page.getByText(`Deel ${chapter + 1} van 5`, { exact: true })).toBeVisible();
    const mode = page.locator('.reader-mode');
    if (await mode.textContent() === 'Naar speelmodus') await mode.click();
    await loadedImage(page, '.reader-art img');
    await expect(page.locator('.reader-story-text p').first()).not.toBeEmpty();
    await expect(page.locator('.reader-choice-heading h3')).toHaveText('Wat kies jij?');
    const special = world.id === 'station' && chapter < 2;
    if (special) await loadedImage(page, '.play-platform');
    else {
      await loadedImage(page, '.illustrated-choice-art');
      await expect(page.locator('.illustrated-choice-option')).toHaveCount(2);
      const playLabels = await page.locator('.illustrated-choice-option strong').allTextContents();
      await page.getByRole('button', { name: 'Naar leesmodus', exact: true }).click();
      expect(await page.locator('.reader-choice strong').allTextContents()).toEqual(playLabels);
      await page.getByRole('button', { name: 'Naar speelmodus', exact: true }).click();
    }
    const index = (storyIndex + chapter) % 2;
    if (special) {
      await page.getByRole('button', { name: 'Naar leesmodus', exact: true }).click();
      await page.locator('.reader-choice').nth(index).click();
    } else {
      await page.locator('.illustrated-choice-option').nth(index).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
    }
    picks.push(index);
    await expect.poll(async () => (await stored(page, world.id)).picks).toEqual(picks);
    await expect(page.locator('.reader-scene h2')).toBeFocused();
    await expect.poll(() => page.locator('.reader-layout').evaluate(node => node.scrollTop)).toBeLessThanOrEqual(1);
    if (chapter < 4) await expect(page.locator('.reader-keepsake')).toHaveCount(0);
  }
  await expect(page.getByText('Jouw avontuur is compleet', { exact: true })).toBeVisible();
  await expect(page.locator('.reader-keepsake strong')).not.toBeEmpty();
  await expect(page.locator('.reader-mode,.illustrated-choice,.station-play')).toHaveCount(0);
  expect(await stored(page, world.id)).toMatchObject({ picks, revision: 5, lastCompletedPicks: picks });
  const result = await stored(page, world.id);
  expect(result.lastCompletedContentVersion).toBe(result.contentVersion);
});

test('illustrated choices remain usable with large text across phone, tablet and desktop widths', async ({ page }) => {
  await syntheticProfile(page, { level: 'under6', large: true });
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lezen?story=ocean');
    await loadedImage(page, '.illustrated-choice-art');
    await expect(page.locator('.reader-shell')).toHaveClass(/reader-large-text/);
    const geometry = await page.locator('.reader-shell').evaluate(shell => {
      const buttons = Array.from(shell.querySelectorAll<HTMLElement>('.illustrated-choice-option'));
      const play = shell.querySelector<HTMLElement>('.illustrated-choice')!;
      return { noOverflow: document.documentElement.scrollWidth <= innerWidth && shell.scrollWidth <= shell.clientWidth + 1, targets: buttons.map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })), overflow: getComputedStyle(play).overflowY };
    });
    expect(geometry.noOverflow).toBe(true);
    expect(geometry.overflow).not.toMatch(/auto|scroll/);
    for (const target of geometry.targets) { expect(target.width).toBeGreaterThanOrEqual(48); expect(target.height).toBeGreaterThanOrEqual(48); }
    await page.getByRole('button', { name: 'Naar leesmodus', exact: true }).click();
    await expect(page.locator('.reader-choice')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Naar speelmodus', exact: true })).toBeFocused();
  }
});

test('parent profile reading preferences preserve the active route, chapter, pinned edition and progress', async ({ page }) => {
  await syntheticProfile(page, { world: 'station', picks: [1, 0] });
  await page.goto('/lezen?story=station');
  await expect(page.locator('.reader-shell select')).toHaveCount(0);
  const initial = await stored(page, 'station');
  const textMiddle = await page.locator('.reader-story-text').innerText();
  async function chooseInProfile(level: string) {
    await page.goto('/ouders');
    await expect(page.locator('.pd-shell,.local-parent-gate')).toBeVisible();
    if (await page.locator('#local-parent-answer').count()) { await page.locator('#local-parent-answer').fill('12'); await page.getByRole('button', { name: 'Naar de ouderomgeving', exact: true }).click(); }
    await page.getByRole('button', { name: 'Profiel van Avonturier bewerken' }).click();
    await page.locator('#pd-profile-reading-level').selectOption(level);
    await page.getByRole('button', { name: 'Profiel bewaren', exact: true }).click();
    await page.goto('/lezen?story=station&readingLevel=9plus');
    await expect(page.getByText('Deel 3 van 5', { exact: true })).toBeVisible();
    await expect(page.locator('.reader-shell select')).toHaveCount(0);
    expect(await stored(page, 'station')).toEqual(initial);
  }
  await chooseInProfile('under6');
  const textYoung = await page.locator('.reader-story-text').innerText();
  expect(textYoung).not.toBe(textMiddle);
  await chooseInProfile('9plus');
  expect(await page.locator('.reader-story-text').innerText()).not.toBe(textYoung);
  expect((await stored(page, 'station')).picks).toEqual([1, 0]);
});

test('re-reading a finished route does not rewrite progress, memories or earned keepsakes', async ({ page }) => {
  const route = [1, 0, 1, 0, 1];
  await syntheticProfile(page, { world: 'dream', picks: route });
  await page.goto('/lezen?story=dream');
  await expect(page.getByText('Jouw avontuur is compleet', { exact: true })).toBeVisible();
  const snapshot = () => page.evaluate(base => Object.fromEntries(['story-dream', 'memory', 'completed'].map(field => [field, localStorage.getItem(base + field)])), childKey);
  const before = await snapshot();
  await page.getByRole('button', { name: 'Lees je route opnieuw', exact: true }).click();
  for (let chapter = 0; chapter < 5; chapter++) {
    await expect(page.getByText(`Deel ${chapter + 1} van 5`, { exact: true })).toBeVisible();
    await expect(page.locator('.reader-replay .reader-primary')).toHaveCount(1);
    await expect(page.locator('.reader-mode,.illustrated-choice,.station-play')).toHaveCount(0);
    expect(await snapshot()).toEqual(before);
    await page.locator('.reader-replay .reader-primary').click();
    await expect(page.locator('.reader-scene h2')).toBeFocused();
    await expect.poll(() => page.locator('.reader-layout').evaluate(node => node.scrollTop)).toBeLessThanOrEqual(1);
  }
  await expect(page.getByText('Jouw avontuur is compleet', { exact: true })).toBeVisible();
  expect(await snapshot()).toEqual(before);
  await page.getByRole('button', { name: 'Een ander pad ontdekken', exact: true }).click();
  await expect(page.getByText('Deel 1 van 5', { exact: true })).toBeVisible();
  expect(await stored(page, 'dream')).toMatchObject({ picks: [], lastCompletedPicks: route });
});

test('a saved custom edition is never overwritten by current reading-level rewrites', async ({ page, request }) => {
  const response = await request.get('/api/content/dream');
  const { release } = await response.json();
  delete release.readingLevels;
  release.contentVersion = 'feed000000000001';
  release.scenes[''].text = 'Dit is de vastgezette, eigen tekst van deze oudere uitgave.';
  await syntheticProfile(page, { world: 'dream', picks: [], version: release.contentVersion, release });
  await page.goto('/lezen?story=dream');
  await expect(page.locator('.reader-story-text')).toHaveText(release.scenes[''].text);
  await expect(page.locator('.reader-shell select')).toHaveCount(0);
  await expect(page.locator('.reader-level-note')).toContainText('bewaarde verhaalversie');
  expect((await stored(page, 'dream')).contentVersion).toBe('feed000000000001');
});

test('an unchanged original edition supports reading levels without changing its saved content pin', async ({ page, request }) => {
  const { release } = await (await request.get('/api/content/dream')).json();
  const expected = release.readingLevels['6to8'].scenes['10'].text.replaceAll('__FABELPAD_CHILD__', 'Avonturier');
  delete release.readingLevels;
  release.contentVersion = 'feed000000000002';
  await syntheticProfile(page, { world: 'dream', picks: [1, 0], version: release.contentVersion, release });
  await page.goto('/lezen?story=dream');
  await expect(page.locator('.reader-shell select')).toHaveCount(0);
  expect((await page.locator('.reader-story-text').innerText()).replace(/\s+/gu, ' ').trim()).toBe(expected.replace(/\s+/gu, ' ').trim());
  const before = await stored(page, 'dream');
  await page.goto('/ouders');
    await expect(page.locator('.pd-shell,.local-parent-gate')).toBeVisible();
    if (await page.locator('#local-parent-answer').count()) { await page.locator('#local-parent-answer').fill('12'); await page.getByRole('button', { name: 'Naar de ouderomgeving', exact: true }).click(); }
  await page.getByRole('button', { name: 'Profiel van Avonturier bewerken' }).click();
  await page.locator('#pd-profile-reading-level').selectOption('under6');
  await page.getByRole('button', { name: 'Profiel bewaren', exact: true }).click();
  await page.goto('/lezen?story=dream');
  expect((await page.locator('.reader-story-text').innerText()).replace(/\s+/gu, ' ').trim()).not.toBe(expected.replace(/\s+/gu, ' ').trim());
  expect(await stored(page, 'dream')).toEqual(before);
  expect(before).toMatchObject({ picks: [1, 0], contentVersion: 'feed000000000002' });
});
