import { test, expect, type Page } from '@playwright/test';

// These fixtures use a separate, synthetic device profile. No account, mail or
// hosted family data is needed to exercise the production reader components.
const scope = 'fabelpad-scope-prototype-demo::';
const child = 'child-reader-regression';
const storyKey = `${scope}fabelpad-child-${child}-story-station`;
type Progress = { picks: number[]; revision: number; contentVersion?: string };

async function deviceProfile(page: Page, options: { large?: boolean; muted?: boolean; calm?: boolean; picks?: number[] } = {}) {
  await page.addInitScript(({ prefix, profile, settings, initialPicks }) => {
    localStorage.setItem(`${prefix}fabelpad-family`, JSON.stringify({ version: 1, children: [{ id: profile, name: 'Avonturier', avatar: 0 }], activeId: profile }));
    const prefs = `${prefix}fabelpad-child-${profile}-prefs`;
    if (!localStorage.getItem(prefs)) localStorage.setItem(prefs, JSON.stringify(settings));
    const saved = `${prefix}fabelpad-child-${profile}-story-station`;
    if (initialPicks && !localStorage.getItem(saved)) localStorage.setItem(saved, JSON.stringify({ picks: initialPicks, revision: initialPicks.length, updatedAt: 1, storyId: 'station' }));
  }, { prefix: scope, profile: child, settings: { muted: options.muted ?? false, calm: options.calm ?? false, textSize: options.large ? 'large' : 'normal' }, initialPicks: options.picks });
}

async function progress(page: Page): Promise<Progress> {
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), storyKey);
}

async function sceneBeginsAtTop(page: Page, part: number) {
  await expect(page.getByText(`Deel ${part} van 5`, { exact: true })).toBeVisible();
  await expect(page.locator('.reader-scene h2')).toBeFocused();
  await expect.poll(() => page.locator('.reader-layout').evaluate(node => node.scrollTop)).toBeLessThanOrEqual(1);
  // A retiring scene or focus effect must not scroll back down afterwards.
  await page.waitForTimeout(300);
  expect(await page.locator('.reader-layout').evaluate(node => node.scrollTop)).toBeLessThanOrEqual(1);
}

async function completeFirstTask(page: Page, choice: 0 | 1) {
  await page.getByRole('button', { name: choice === 0 ? 'Help Dibbel met zijn gescheurde kaartje' : 'Onderzoek de gouden sleutel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Instappen', exact: true })).toHaveCount(0);
  expect((await progress(page)).picks).toEqual([]);
  await page.getByRole('button', { name: choice === 0 ? /Plak de sterrensticker/ : /Draai de gouden sleutel/ }).click();
  expect((await progress(page)).picks).toEqual([]);
  await expect(page.getByRole('button', { name: 'Instappen', exact: true })).toBeVisible();
}

test('reader follows one accessible vertical column at phone, tablet and desktop widths', async ({ page }) => {
  await deviceProfile(page);
  for (const width of [360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/lezen?story=station');
    await expect(page.locator('.station-play')).toBeVisible();
    await expect(page.locator('.reader-topbar .reader-mode')).toHaveCount(0);
    await expect(page.getByText('Jouw keuze komt tot leven.', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Naar de speelprent', exact: true })).toHaveCount(0);
    const layout = await page.locator('.reader-shell').evaluate(shell => {
      const nodes = ['.reader-topbar', '.reader-art', '.reader-progress-row', '.reader-scene h2', '.reader-story-text', '.reader-choice-heading', '.reader-play-panel', '.reader-controls'].map(selector => shell.querySelector<HTMLElement>(selector)!);
      const ordered = nodes.every((node, i) => node && (i === 0 || !!(nodes[i - 1].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)));
      const verticallyOrdered = nodes.every((node, i) => i === 0 || nodes[i - 1].getBoundingClientRect().bottom <= node.getBoundingClientRect().top + 1);
      const art = shell.querySelector<HTMLImageElement>('.reader-art img')!;
      const play = shell.querySelector<HTMLElement>('.reader-play-panel')!;
      const scrollContainers = Array.from(shell.querySelectorAll<HTMLElement>('*')).filter(node => /^(auto|scroll)$/.test(getComputedStyle(node).overflowY) && node.scrollHeight > node.clientHeight + 1).map(node => node.className);
      const controls = Array.from(shell.querySelectorAll<HTMLButtonElement>('.reader-back,.reader-close,.reader-mode,.reader-speech,.play-scene-top button')).map(node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height }));
      return { ordered, verticallyOrdered, shellWidth: shell.getBoundingClientRect().width, heroHeight: shell.querySelector('.reader-art')!.getBoundingClientRect().height, heroIsInert: !art.closest('button,a,[role="button"]'), fontSize: parseFloat(getComputedStyle(shell.querySelector('.reader-story-text p')!).fontSize), playPosition: getComputedStyle(play).position, playOverflow: getComputedStyle(play).overflowY, scrollContainers, controls, noOverflow: document.documentElement.scrollWidth <= innerWidth && shell.scrollWidth <= shell.clientWidth + 1 };
    });
    expect(layout.ordered).toBe(true);
    expect(layout.verticallyOrdered).toBe(true);
    expect(layout.heroIsInert).toBe(true);
    expect(layout.heroHeight).toBeGreaterThanOrEqual(210);
    expect(layout.heroHeight).toBeLessThanOrEqual(345);
    expect(layout.shellWidth).toBeLessThanOrEqual(862);
    expect(layout.fontSize).toBeGreaterThanOrEqual(16);
    expect(layout.noOverflow).toBe(true);
    expect(layout.playPosition).not.toMatch(/sticky|fixed/);
    expect(layout.playOverflow).not.toMatch(/auto|scroll/);
    expect(layout.scrollContainers).toHaveLength(1);
    expect(layout.scrollContainers[0]).toMatch(/^reader-layout(?: |$)/);
    for (const control of layout.controls) { expect(control.width).toBeGreaterThanOrEqual(44); expect(control.height).toBeGreaterThanOrEqual(44); }

    const mode = page.getByRole('button', { name: 'Naar leesmodus', exact: true });
    await mode.scrollIntoViewIfNeeded();
    const before = await page.locator('.reader-layout').evaluate(node => node.scrollTop);
    const saved = await progress(page);
    await mode.click();
    await expect(page.getByRole('button', { name: 'Naar speelmodus', exact: true })).toBeFocused();
    await expect(page.locator('.reader-choice')).toHaveCount(2);
    await expect(page.locator('.station-play')).toHaveCount(0);
    expect(Math.abs(await page.locator('.reader-layout').evaluate(node => node.scrollTop) - before)).toBeLessThanOrEqual(2);
    expect(await progress(page)).toEqual(saved);
    await page.getByRole('button', { name: 'Naar speelmodus', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Naar leesmodus', exact: true })).toBeFocused();
    expect(Math.abs(await page.locator('.reader-layout').evaluate(node => node.scrollTop) - before)).toBeLessThanOrEqual(2);
    expect(await progress(page)).toEqual(saved);
  }
});

for (const choice of [0, 1] as const) test(`both playable station parts keep route ${choice}, gate the task and commit each choice once`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceProfile(page);
  await page.goto('/lezen?story=station');
  await completeFirstTask(page, choice);
  await page.getByRole('button', { name: 'Instappen', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await sceneBeginsAtTop(page, 2);
  expect((await progress(page)).picks).toEqual([choice]);
  expect((await progress(page)).revision).toBe(1);
  await expect(page.locator('.reader-story-text')).toContainText(choice === 0 ? 'Dibbel' : 'De sleutel past');
  await page.getByRole('button', { name: choice === 0 ? 'Zet de wissel naar het muziekbos' : 'Zet de wissel naar de lantaarns', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await sceneBeginsAtTop(page, 3);
  expect((await progress(page)).picks).toEqual([choice, choice]);
  expect((await progress(page)).revision).toBe(2);
  await expect(page.locator('.reader-story-text')).toContainText(choice === 0 ? 'zingende bloesembomen' : 'De lantaarns wijzen');
  await expect(page.locator('.reader-choice')).toHaveCount(2);
  await expect(page.locator('.reader-play-panel')).toHaveCount(0);
  await expect(page.locator('.reader-mode')).toHaveCount(0);
});

for (const part of [1, 2]) test(`leaving playable part ${part} cancels its pending choice on mode change and close`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await deviceProfile(page, { picks: part === 1 ? [] : [0] });
  await page.goto('/lezen?story=station');
  await expect(page.getByText(`Deel ${part} van 5`, { exact: true })).toBeVisible();
  const leave = async () => {
    if (part === 1) {
      await completeFirstTask(page, 1);
      await page.getByRole('button', { name: 'Instappen', exact: true }).click();
    } else await page.getByRole('button', { name: 'Zet de wissel naar de lantaarns', exact: true }).click();
    await expect(page.locator('.station-play')).toHaveAttribute('aria-busy', 'true');
  };
  const saved = await progress(page);
  await leave();
  // Dispatch both actions in the same task: cancellation must not depend on
  // animation speed, viewport auto-scrolling or a race with test automation.
  await page.locator('.reader-mode').evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.locator('.station-play')).toHaveCount(0);
  await page.waitForTimeout(1_200);
  expect(await progress(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Naar speelmodus', exact: true }).click();
  await leave();
  await page.getByRole('button', { name: 'Verhaal sluiten', exact: true }).evaluate(button => (button as HTMLButtonElement).click());
  await expect(page.locator('.reader-shell')).toHaveCount(0);
  await page.waitForTimeout(1_200);
  expect(await progress(page)).toEqual(saved);
  await page.getByRole('button', { name: 'Open Het Verdwaalde Station', exact: true }).click();
  await expect(page.getByText(`Deel ${part} van 5`, { exact: true })).toBeVisible();
  expect((await progress(page)).picks).toEqual(part === 1 ? [] : [0]);
});

test('large text, ending, restart and reopening preserve progress and restore the page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await deviceProfile(page, { large: true, picks: [1, 0, 1, 0] });
  await page.goto('/lezen');
  await expect(page.locator('.world-card')).toHaveCount(13);
  await page.evaluate(() => { document.body.style.overflow = 'auto'; });
  const opener = page.getByRole('button', { name: 'Open Het Verdwaalde Station', exact: true });
  await opener.scrollIntoViewIfNeeded();
  const originalScroll = await page.evaluate(() => scrollY);
  await opener.click();
  await expect(page.getByText('Deel 5 van 5', { exact: true })).toBeVisible();
  await expect(page.locator('.reader-shell')).toHaveClass(/reader-large-text/);
  expect(await page.locator('.reader-story-text p').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize))).toBeGreaterThanOrEqual(19);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  await page.locator('.reader-choice').last().click();
  await expect(page.getByText('Jouw avontuur is compleet', { exact: true })).toBeVisible();
  await expect(page.locator('.reader-scene h2')).toBeFocused();
  await expect.poll(() => page.locator('.reader-layout').evaluate(node => node.scrollTop)).toBeLessThanOrEqual(1);
  await expect(page.locator('.reader-choice-section,.reader-play-panel,.reader-mode')).toHaveCount(0);
  expect((await progress(page)).picks).toEqual([1, 0, 1, 0, 1]);
  await page.getByRole('button', { name: 'Verhaal sluiten', exact: true }).click();
  await expect(page.locator('.reader-shell')).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('auto');
  expect(Math.abs(await page.evaluate(() => scrollY) - originalScroll)).toBeLessThanOrEqual(2);
  await opener.click();
  await expect(page.getByText('Jouw avontuur is compleet', { exact: true })).toBeVisible();
  expect((await progress(page)).picks).toEqual([1, 0, 1, 0, 1]);
  await page.getByRole('button', { name: 'Een ander pad ontdekken', exact: true }).click();
  await sceneBeginsAtTop(page, 1);
  await expect(page.locator('.station-play')).toBeVisible();
  expect((await progress(page)).picks).toEqual([]);
  expect((await progress(page)).revision).toBe(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('local narration pauses and resumes without restarting when the play mode changes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await deviceProfile(page);
  await page.addInitScript(() => {
    const calls = { speak: 0, pause: 0, resume: 0, cancel: 0 };
    Object.defineProperty(window, '__readerSpeech', { value: calls });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { text: string; constructor(text: string) { this.text = text; } } });
    Object.defineProperty(window, 'speechSynthesis', { value: { getVoices: () => [{ lang: 'nl-NL', localService: true, name: 'Synthetic local test voice' }], addEventListener() {}, removeEventListener() {}, speak() { calls.speak++; }, pause() { calls.pause++; }, resume() { calls.resume++; }, cancel() { calls.cancel++; } } });
  });
  await page.goto('/lezen?story=station');
  await page.getByRole('button', { name: 'Lees voor', exact: true }).click();
  await page.getByRole('button', { name: 'Even pauzeren', exact: true }).click();
  await page.getByRole('button', { name: 'Verder luisteren', exact: true }).click();
  const calls = () => page.evaluate(() => (window as unknown as { __readerSpeech: { speak: number; pause: number; resume: number; cancel: number } }).__readerSpeech);
  const before = await calls();
  expect(before).toMatchObject({ speak: 1, pause: 1, resume: 1 });
  await page.getByRole('button', { name: 'Naar leesmodus', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Even pauzeren', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Naar speelmodus', exact: true }).click();
  expect(await calls()).toEqual(before);
  await page.getByRole('button', { name: 'Naar leesmodus', exact: true }).click();
  await page.locator('.reader-choice').last().click();
  await sceneBeginsAtTop(page, 2);
  expect((await progress(page)).picks).toEqual([1]);
  await expect(page.locator('.reader-story-text')).toContainText('De sleutel past');
  await expect(page.getByRole('button', { name: 'Lees voor', exact: true })).toBeVisible();
  await page.locator('.reader-choice').first().click();
  await sceneBeginsAtTop(page, 3);
  expect((await progress(page)).picks).toEqual([1, 0]);
  await expect(page.locator('.reader-story-text')).toContainText('zingende bloesembomen');
  await expect(page.locator('.reader-mode,.reader-play-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Verhaal sluiten', exact: true }).click();
  await expect(page.locator('.reader-shell')).toHaveCount(0);
  await page.getByRole('button', { name: 'Geluid uitzetten', exact: true }).click();
  await page.getByRole('button', { name: 'Open Het Verdwaalde Station', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Geluid staat uit', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Luister naar de opdracht', exact: true })).toHaveCount(0);
  expect((await calls()).speak).toBe(1);
});
