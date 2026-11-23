import { test, expect } from '@playwright/test';
const activeParent = { state: 'active', termsVersion: '2026-11-22', privacyVersion: '2026-11-23', acceptedTermsVersion: '2026-11-22', shownPrivacyVersion: '2026-11-23', lastActivityAt: '2026-11-22T12:00:00Z', deletionDeadline: null, consents: [] };

test('website, child library, family and admin routes stay distinct without simulated roles or plans', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Er was eens');
  await expect(page.locator('body')).not.toContainText(/demo|prototype|founders|abonnementsvoorstel/i);
  await page.getByRole('button', { name: 'Start met lezen', exact: true }).first().click();
  await expect(page).toHaveURL(/\/lezen$/);
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expect(page.locator('body')).not.toContainText(/demo|prototype/i);
  await expect(page.getByRole('link', { name: 'Inloggen als ouder', exact: true }).first()).toHaveAttribute('href', '/inloggen');
  await page.goto('/demo?surface=studio');
  await expect(page).toHaveURL(/\/lezen$/);
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expect(page.getByRole('complementary', { name: 'Fabelpad prototype-onderdelen' })).toHaveCount(0);
  // A former local paywall preference must never restrict the free catalogue.
  await page.evaluate(() => localStorage.setItem('fabelpad-prototype-access-v1', JSON.stringify({ testAccess: true, freeStory: 'station', plan: 'free' })));
  await page.goto('/lezen?story=dream');
  await expect(page.getByRole('dialog', { name: /Droompost/i })).toBeVisible();
  await page.locator('.reader-choice,.illustrated-choice-option').first().click();
  await expect(page.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
  await page.goto('/ouders');
  await page.locator('#local-parent-answer').fill('12');
  await page.getByRole('button', { name: 'Naar de ouderomgeving', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ons gezin');
  await expect(page.locator('body')).not.toContainText(/demo|prototype|abonnement|founder/i);
  await expect(page.getByRole('link', { name: 'Inloggen als ouder' })).toHaveAttribute('href', '/inloggen');
  await page.goto('/support');
  await expect(page.getByRole('heading', { level: 1, name: 'Hulp bij Fabelpad' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'support@fabelpad.nl', exact: true }).first()).toHaveAttribute('href', 'mailto:support@fabelpad.nl');
  await expect(page.locator('body')).not.toContainText(/demo|prototype/i);
  await page.goto('/inloggen');
  await expect(page.getByRole('link', { name: 'Ontdek Fabelpad zonder account →' })).toBeVisible();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await page.goto('/studio');
  await expect(page.getByText('De beheeromgeving is op dit moment niet beschikbaar.', { exact: false })).toBeVisible();
  await expect(page.locator('body')).not.toContainText(/demo|prototype/i);
  const response = await request.put('/api/content/drafts/station', { data: { baseRevision: 0, draft: {} } });
  expect(response.status()).toBe(503);
  expect((await request.get('/api/family')).status()).toBe(503);
  const catalog = await (await request.get('/api/content')).json();
  expect(catalog.stories).toHaveLength(13);
  const release = await (await request.get('/api/content/station')).json();
  expect(Object.keys(release.release.scenes)).toHaveLength(31);
  expect(Object.keys(release.release.endings)).toHaveLength(32);
  const invalid = await request.get('/api/content/station?version=0000000000000000');
  expect(invalid.status()).toBe(404);
  expect(errors).toEqual([]);
});

test('story persists its route/version, rejects double taps and retains a prior edition', async ({ page }) => {
  await page.goto('/lezen?story=dream');
  const dialog = page.getByRole('dialog', { name: /Droompost/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Deel 1 van 5', { exact: true })).toBeVisible();
  await page.locator('.reader-choice,.illustrated-choice-option').first().evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(dialog.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
  const savedBefore = await page.evaluate(() => Object.entries(localStorage).find(([key]) => key.includes('story-dream'))?.[1]);
  expect(JSON.parse(savedBefore!).picks).toEqual([0]);
  expect(JSON.parse(savedBefore!).contentVersion).toMatch(/^[a-f0-9]{16}$/);
  await page.reload();
  await expect(dialog.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
  // A new local publication cannot rewrite a route pinned to the prior edition.
  await page.evaluate(() => localStorage.setItem('fabelpad-prototype-editorial-v1', JSON.stringify({ schemaVersion:1,drafts:{},published:{dream:{metadata:{title:'Gewijzigde editie',description:'Een nieuwe uitgave',image:'/art/dream.webp'},chapters:{'1':{text:'Deze tekst is pas later gepubliceerd.'}},updatedAt:new Date().toISOString(),publishedAt:new Date().toISOString(),version:1}} })));
  await page.reload();
  await expect(page.locator('.reader-story-text')).not.toContainText('Deze tekst is pas later gepubliceerd.');
  for (let part = 2; part <= 5; part++) {
    await expect(page.getByText(`Deel ${part} van 5`, { exact: true })).toBeVisible();
    await page.locator('.reader-choice,.illustrated-choice-option').first().click();
  }
  await expect(page.getByText('Jouw avontuur is compleet', { exact: true })).toBeVisible();
  await expect(page.locator('.reader-keepsake strong')).not.toBeEmpty();
  await page.getByRole('button', { name: 'Verhaal sluiten' }).click();
  await page.getByRole('button', { name: 'Schatkist', exact: true }).first().click();
  await expect(page.locator('.stamp-card.unlocked').first()).toBeVisible();
});

test('phone layout and storage failures remain usable and truthful', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Unavailable', 'QuotaExceededError'); }; });
  await page.goto('/lezen?story=toy');
  await expect(page.locator('.reader-saved')).toContainText('Bewaren lukt niet');
  await expect(page.locator('.reader-choice,.illustrated-choice-option')).toHaveCount(2);
  await page.locator('.reader-choice,.illustrated-choice-option').first().click();
  await expect(page.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('station actions advance once and closing cancels the departing scene', async ({ page }) => {
  await page.goto('/lezen?story=station');
  await page.getByRole('button', { name: 'Help Dibbel met zijn gescheurde kaartje' }).click();
  await page.getByRole('button', { name: /sterrensticker/i }).click();
  const board = page.getByRole('button', { name: /instappen/i });
  await board.evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
  await expect(page.getByText('Deel 2 van 5', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zet de wissel naar het muziekbos' }).click();
  await page.getByRole('button', { name: 'Verhaal sluiten' }).click();
  const saved = await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) => key.includes('story-station'))![1]).picks);
  expect(saved.length).toBeLessThanOrEqual(2);
  await page.waitForTimeout(700); // Wait beyond the departing scene's scheduled callback.
  expect(await page.evaluate(() => JSON.parse(Object.entries(localStorage).find(([key]) => key.includes('story-station'))![1]).picks)).toEqual(saved);
});

test('family UI uses server metadata, isolates siblings and opens parent settings (mocked session)', async ({ page }) => {
  const parent = { id: 'test-parent-a', email: 'parent@example.test', displayName: 'Testouder' };
  let snapshot = { schemaVersion:1, family:{version:1,children:[{id:'test-mila',name:'Mila',avatar:0},{id:'test-bo',name:'Bo',avatar:1}],activeId:'test-mila'},data:{'test-mila':{},'test-bo':{}} };
  let revision = 1;
  await page.route('**/api/auth/session', route => route.fulfill({json:{configured:true,parent,admin:false,providers:{email:true,google:false},lifecycle:activeParent}}));
  await page.route('**/api/parent/status', route => route.fulfill({json:activeParent}));
  await page.route('**/api/family', async route => {
    if (route.request().method() === 'PUT') { snapshot = route.request().postDataJSON().snapshot; revision++; }
    await route.fulfill({json:{parent,revision,snapshot}});
  });
  await page.route('**/api/content/dream*',async route=>{const response=await route.fetch();const value=await response.json();await route.fulfill({json:{...value,configured:true,release:{...value.release,access:'full',offlineUntil:new Date(Date.now()+60_000).toISOString()}}});});
  await page.addInitScript(() => localStorage.setItem('fabelpad-prototype-editorial-v1', JSON.stringify({ schemaVersion:1,drafts:{},published:{dream:{metadata:{title:'Uitsluitend demoversie',description:'Lokale tekst',image:'/art/dream.webp'},chapters:{},updatedAt:new Date().toISOString(),publishedAt:new Date().toISOString(),version:1}} })));
  await page.goto('/gezin');
  await expect(page.locator('.world-card')).toHaveCount(13);
  await expect(page.locator('.world-grid')).not.toContainText('Uitsluitend demoversie');
  await page.getByRole('button', { name: 'Open De Droompost' }).click();
  await page.locator('.reader-choice,.illustrated-choice-option').first().click();
  await expect(page.getByText('Deel 2 van 5', { exact:true })).toBeVisible();
  await page.getByRole('button', { name:'Verhaal sluiten' }).click();
  await page.getByRole('button', { name:'Kindprofiel kiezen' }).click();
  await page.getByRole('button', { name:'Verder als Bo',exact:true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open De Droompost' }).click();
  await expect(page.getByText('Deel 1 van 5', { exact:true })).toBeVisible();
  await page.getByRole('button', { name:'Verhaal sluiten' }).click();
  await page.getByRole('button', { name:'Voor ouders',exact:true }).first().click();
  await page.locator('#parent-answer').fill('12');
  await page.getByRole('button', { name:'Naar het ouderhoekje' }).click();
  await expect(page.getByRole('heading', { name:'Ons gezin', exact:true })).toBeVisible();
  await page.getByRole('link', { name:'Ouderaccount openen', exact:true }).click();
  await expect(page.getByRole('button', { name:'Gezinsgegevens downloaden' })).toBeVisible();
});

test('studio prevents edits while saving a server concept (mocked admin session)', async ({ page }) => {
  const parent = {id:'test-admin',email:'admin@example.test',displayName:'Beheerder'};
  let draft = {metadata:{title:'Het Verdwaalde Station',description:'Een verhaal',image:'/art/station.webp'},chapters:{},updatedAt:''};
  let finishSave: (()=>void) | undefined;
  await page.route('**/api/auth/session', route => route.fulfill({json:{configured:true,parent,admin:true,lifecycle:activeParent}}));
  await page.route('**/api/content/drafts/station', async route => {
    if (route.request().method() === 'PUT') {
      draft = route.request().postDataJSON().draft;
      await new Promise<void>(resolve => { finishSave=resolve; });
      await route.fulfill({json:{saved:true,revision:1,draft}});
    } else await route.fulfill({json:{storyId:'station',revision:0,draft}});
  });
  await page.goto('/studio');
  const title = page.getByRole('textbox', {name:'Verhaaltitel',exact:true});
  await title.fill('Een nieuwe stationseditie');
  await page.getByRole('button', {name:'Concept bewaren',exact:true}).click();
  await expect(title).toBeDisabled();
  await expect.poll(()=>!!finishSave).toBeTruthy();
  finishSave!();
  await expect(title).toBeEnabled();
  await expect(page.getByText('Concept op de server bewaard. Lezers zien de huidige publicatie.')).toBeVisible();
  await expect(title).toHaveValue('Een nieuwe stationseditie');
});

test('email login asks for a code and preserves a safe studio return (mocked provider)', async ({ page }) => {
  let verified = false;
  let verification: Record<string, unknown> | undefined;
  await page.route('**/api/auth/session', route => route.fulfill({json:{configured:true,parent:verified?{id:'test-parent',email:'parent@example.test',displayName:'Testouder'}:null,admin:false,providers:{email:true,google:false}}}));
  await page.route('**/api/auth/otp', route => route.fulfill({json:{ok:true,message:'Je Fabelpad-inlogcode is aangevraagd.'}}));
  await page.route('**/api/auth/verify', route => {
    verification = route.request().postDataJSON(); verified = true;
    return route.fulfill({json:{ok:true,next:'/studio'}});
  });
  await page.goto('/inloggen?next=%2Fstudio');
  await page.getByRole('textbox', {name:'Jouw e-mailadres'}).fill('parent@example.test');
  await page.getByRole('button', {name:'Stuur mij een inlogcode'}).click();
  await expect(page.getByRole('textbox', {name:'Jouw e-mailadres'})).toBeDisabled();
  await expect(page.getByText('Je Fabelpad-inlogcode is aangevraagd.')).toBeVisible();
  await page.getByRole('textbox', {name:'6-cijferige code uit je e-mail'}).fill('123456');
  await page.getByRole('button', {name:'Veilig inloggen'}).click();
  await expect(page).toHaveURL(/\/studio$/);
  expect(verification).toEqual({email:'parent@example.test',token:'123456',next:'/studio'});
  await expect(page.getByText('Dit ouderaccount heeft geen toegang tot de verhalenstudio.')).toBeVisible();
});

test('an auth link needs an explicit action and removes its credential from the URL', async ({ page }) => {
  let confirmations = 0;
  let confirmation: Record<string, unknown> | undefined;
  await page.route('**/api/auth/confirm', route => {
    confirmations++; confirmation = route.request().postDataJSON();
    return route.fulfill({json:{ok:true,next:'/inloggen',message:'Bevestiging ontvangen voor deze test.'}});
  });
  const response = await page.goto('/auth/confirm?type=invite&token_hash=synthetic-token-hash-for-browser-test&next=https%3A%2F%2Fattacker.example.test');
  expect(response?.headers()['referrer-policy']).toBe('no-referrer');
  await expect(page).toHaveURL(/\/auth\/confirm$/);
  await expect(page.getByRole('button', {name:'Bevestig en ga verder'})).toBeVisible();
  expect(confirmations).toBe(0);
  await expect(page.locator('body')).not.toContainText('synthetic-token-hash-for-browser-test');
  await page.getByRole('button', {name:'Bevestig en ga verder'}).click();
  await expect(page.getByText('Bevestiging ontvangen voor deze test.')).toBeVisible();
  expect(confirmations).toBe(1);
  expect(confirmation).toEqual({type:'invite',tokenHash:'synthetic-token-hash-for-browser-test',next:'/gezin'});
  await expect(page.getByRole('button', {name:'Bevestig en ga verder'})).toHaveCount(0);
});

test('a failed session request remains an availability error without a false local-mode claim', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.fulfill({status:503,json:{error:'backend_unavailable',message:'De backend is tijdelijk niet bereikbaar.'}}));
  await page.goto('/inloggen');
  await expect(page.getByText('De accountverbinding is nu niet bereikbaar. Je kunt wel zonder account verder lezen.')).toBeVisible();
  await expect(page.getByText('Ouderaccounts zijn nog niet aangesloten.')).toHaveCount(0);
  await expect(page.getByRole('textbox')).toHaveCount(0);
});
