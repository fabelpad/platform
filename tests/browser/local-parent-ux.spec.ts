import { test, expect, type Page } from '@playwright/test';

const familyKey = 'fabelpad-scope-prototype-demo::fabelpad-family';
async function openParents(page: Page, count = 2) {
  await page.addInitScript(({ key, count }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ version: 1, activeId: 'local-child-0', children: Array.from({ length: count }, (_, index) => ({ id: `local-child-${index}`, name: ['Nora', 'Bo', 'Pip', 'Noor', 'Sam'][index], avatar: index % 4, birthDate: '2019-11-23' })) }));
    const progress = 'fabelpad-scope-prototype-demo::fabelpad-child-local-child-1-story-dream';
    if (!localStorage.getItem(progress)) localStorage.setItem(progress, JSON.stringify({ choices: [0, 1], part: 3 }));
  }, { key: familyKey, count });
  await page.goto('/ouders');
  await page.getByLabel('7 + 5 =', { exact: true }).fill('12');
  await page.getByRole('button', { name: 'Naar de ouderomgeving', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ons gezin', exact: true })).toBeVisible();
}

for (const width of [320, 390, 768, 1280]) test(`local parent navigation and profile list work at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await openParents(page);
  await expect(page.locator('.pd-header')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Terug naar de verhalen', exact: true })).toBeVisible();
  await expect(page.locator('.pd-child')).toHaveCount(2);
  expect((await page.getByRole('heading', { name: 'Kindprofielen', exact: true }).boundingBox())!.y).toBeLessThan(350);
  await expect(page.locator('.pd-child').first().getByRole('button')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const toggle = page.locator('.pd-menu-toggle');
  if (width <= 760) {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('navigation', { name: 'Mobiele ouderomgeving' }).getByRole('button', { name: 'Mijn gezin', exact: true })).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click(); await page.mouse.click(3, 450);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
  }
  if (width === 390) {
    await page.getByRole('navigation', { name: 'Mobiele ouderomgeving' }).getByRole('button', { name: 'Mijn gezin', exact: true }).focus();
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Mobiele ouderomgeving' })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Ouderomgeving', exact: true }).getByRole('button', { name: 'Mijn gezin', exact: true })).toBeFocused();
    await page.setViewportSize({ width, height: 900 });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false'); await toggle.click();
  }
  await page.getByRole('button', { name: 'Instellingen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Leesinstellingen', exact: true })).toBeVisible();
  if (width <= 760) { await expect(toggle).toHaveAttribute('aria-expanded', 'false'); await toggle.click(); }
  await page.getByRole('button', { name: 'Mijn gezin', exact: true }).click();
  await page.getByRole('button', { name: 'Terug naar de verhalen', exact: true }).click();
  await expect(page).toHaveURL(/\/lezen$/);
  await expect(page.locator('.world-card')).toHaveCount(13);
});

test('editing a local profile keeps the fifth-profile limit and another child’s progress', async ({ page }) => {
  await openParents(page, 5);
  await expect(page.getByRole('button', { name: 'Toevoegen', exact: true })).toBeDisabled();
  const edit = page.getByRole('button', { name: 'Profiel van Nora bewerken', exact: true });
  await edit.click();
  const dialog = page.getByRole('dialog', { name: 'Profiel aanpassen', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.locator('#pd-name')).toHaveAttribute('maxlength', '20');
  await page.locator('#pd-name').fill('Nova');
  await page.locator('#pd-profile-reading-level').selectOption('9plus');
  await page.getByRole('button', { name: 'Profiel bewaren', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), familyKey);
  expect(saved.children).toHaveLength(5);
  expect(saved.children[0]).toMatchObject({ name: 'Nova', birthDate: '2019-11-23', readingLevelOverride: '9plus' });
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fabelpad-scope-prototype-demo::fabelpad-child-local-child-1-story-dream')!))).toEqual({ choices: [0, 1], part: 3 });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Profiel van Nova bewerken', exact: true })).toBeVisible();
});

test('the local profile dialog remains usable with a short viewport and restores focus on cancellation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await openParents(page);
  const edit = page.getByRole('button', { name: 'Profiel van Nora bewerken', exact: true });
  await edit.click();
  const dialog = page.getByRole('dialog', { name: 'Profiel aanpassen', exact: true });
  await expect(page.locator('#pd-name')).toBeFocused();
  await page.locator('#pd-name').fill('Niet bewaren');
  await page.getByRole('button', { name: 'Annuleren', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(edit).toBeFocused();
  expect((await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), familyKey)).children[0].name).toBe('Nora');
  await edit.click(); await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0); await expect(edit).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
