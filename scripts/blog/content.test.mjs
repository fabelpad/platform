import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compileSource } from '../source-test-loader.mjs';
const temporary = await mkdtemp(path.join(tmpdir(), 'fabelpad-blog-content-'));
await symlink(new URL('../../node_modules', import.meta.url).pathname, path.join(temporary, 'node_modules'));
const { validateBlogContent, validateBlogDocument, safeBlogLink, normalizeSlug, emptyBlogDocument } = await import(await compileSource(new URL('../../lib/blog/document.ts', import.meta.url), temporary));
const { markdownToBlogContent, markdownToBlogDocument } = await import(await compileSource(new URL('../../lib/blog/markdown.ts', import.meta.url), temporary));
const { blogArticleMetadata, blogStructuredData, serializeBlogJsonLd } = await import(await compileSource(new URL('../../lib/blog/seo.ts', import.meta.url), temporary));
const { blogSite, verifyBlogIdentity } = await import(await compileSource(new URL('../../lib/blog/config.ts', import.meta.url), temporary));
after(() => rm(temporary, { recursive: true, force: true }));
const authorId = '11111111-1111-4111-8111-111111111111', assetId = '22222222-2222-4222-8222-222222222222', ogId = '33333333-3333-4333-8333-333333333333';
const document = () => ({ ...emptyBlogDocument(authorId), title: 'Samen op avontuur', slug: 'samen-op-avontuur', excerpt: 'Een leesidee voor thuis.' });
const request = () => ({ baseRevision: null, type: 'blog', locale: 'nl-NL', title: 'Samen op avontuur', content: { format: 'markdown', body: 'Een **goed** verhaal.' } });
const invalid = value => assert.throws(() => validateBlogContent(value), error => error.code === 'INVALID_CONTENT' && error.status === 422);
const tree = child => ({ type: 'doc', content: [child] });
const paragraph = text => ({ type: 'paragraph', content: [{ type: 'text', text }] });

test('shared schema rejects executable structures, unsupported attributes, invalid topology and resource exhaustion', () => {
  for (const node of [
    { type: 'script', text: 'alert(1)' },
    { type: 'paragraph', attrs: { onClick: 'evil' } },
    { type: 'heading', attrs: { level: 1 } },
    { type: 'heading', attrs: { level: '2' } },
    { type: 'paragraph', content: [{ type: 'image', attrs: { assetId, alt: 'Vos' } }] },
    { type: 'table', content: [paragraph('geen rij')] },
    { type: 'tableRow', content: [] },
    { type: 'bulletList', content: [paragraph('geen lijstitem')] },
    { type: 'image', attrs: { assetId, alt: 'Vos', src: 'https://other.invalid/x' } },
    { type: 'image', attrs: { assetId, alt: '' } },
    { type: 'paragraph', content: [{ type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'kleur', marks: [{ type: 'highlight', attrs: { color: 'url(evil)' } }] }] },
    { type: 'paragraph', content: [{ type: 'text', text: 'dubbel', marks: [{ type: 'bold' }, { type: 'bold' }] }] },
    { type: 'codeBlock', attrs: { language: 'js onclick=x' } },
  ]) invalid(tree(node));
  invalid({ type: 'doc', content: Array.from({ length: 5001 }, () => paragraph('a')) });
  invalid(tree(paragraph('a'.repeat(120001))));
  let deep = paragraph('einde'); for (let n = 0; n < 21; n++) deep = { type: 'blockquote', content: [deep] }; invalid(tree(deep));
});

test('documents produce field-specific errors and normalize slugs without changing stored URLs implicitly', () => {
  assert.equal(normalizeSlug('Één leesavond: groot & klein!'), 'een-leesavond-groot-klein');
  assert.deepEqual(validateBlogDocument(document()), document());
  for (const [field, mutate] of [
    ['title', value => { value.title = ''; }], ['excerpt', value => { value.excerpt = 'a'.repeat(601); }],
    ['seo.title', value => { value.seo.title = 'a'.repeat(201); }], ['seo.description', value => { value.seo.description = 'a'.repeat(321); }],
    ['slug', value => { value.slug = 'Geen geldige slug'; }], ['hero', value => { value.hero = { assetId, alt: 'Vos', focalPoint: { x: 2, y: .5 } }; }],
    ['authorId', value => { value.authorId = 'other'; }], ['tags', value => { value.tags = ['a'.repeat(51)]; }],
  ]) { const value = document(); mutate(value); assert.throws(() => validateBlogDocument(value), error => Object.hasOwn(error.fieldErrors, field)); }
  const changed = document(); changed.title = 'Een nieuwe titel'; assert.equal(validateBlogDocument(changed).slug, 'samen-op-avontuur');
});

test('link protocol validation rejects obfuscated javascript, credentials and header/control injection', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,x', '//evil.invalid', 'https://user:pass@safe.invalid', 'https://safe.invalid/\nx', 'https://safe.invalid/%0d%0aX', '\\evil.invalid', ' javaScript:evil']) assert.throws(() => safeBlogLink(value));
  for (const value of ['https://fabelpad.nl/blog', 'http://example.test/path', '/blog/leesidee#kop', '#leesidee', 'mailto:school@example.test']) assert.equal(safeBlogLink(value), value);
});

test('Markdown imports supported formatting, tables, quotes, lists, images and code into the same editor tree', () => {
  const body = `# Hoofdkop\n\nTekst met **vet**, *schuin*, ~~doorgestreept~~, \`code\` en [een link](https://fabelpad.nl).\n\n> Samen lezen\n\n1. Eerste\n2. Tweede\n\n- Klein\n- Groot\n\n| Naam | Keuze |\n| --- | --- |\n| Vos | Links |\n\n![Een vos](asset:${assetId})\n\n---\n\n\`\`\`js\nconst x = '<script>';\n\`\`\``;
  const result = markdownToBlogContent(body, 'https://staging.fabelpad.nl');
  assert.deepEqual(validateBlogContent(result), result);
  const types = new Set(), marks = new Set();
  const walk = node => { types.add(node.type); for (const mark of node.marks || []) marks.add(mark.type); (node.content || []).forEach(walk); }; walk(result);
  for (const type of ['heading','paragraph','blockquote','orderedList','bulletList','listItem','table','tableHeader','tableCell','image','horizontalRule','codeBlock']) assert.ok(types.has(type), type);
  for (const type of ['bold','italic','strike','code','link']) assert.ok(marks.has(type), type);
  assert.equal(result.content[0].attrs.level, 2, 'Article body never introduces another H1');
  assert.ok(JSON.stringify(result).includes("<script>"), 'Code remains text');
  const html = markdownToBlogContent('<script>alert(1)</script>\n\n<img src=x onerror=evil>');
  assert.ok(JSON.stringify(html).includes('<script>')); assert.ok(!JSON.stringify(html).includes('"type":"script"'));
  assert.throws(() => markdownToBlogContent('![Vos](https://other.invalid/a.png)'));
  assert.throws(() => markdownToBlogContent('![Vos](https://fabelpad.nl/api/blog/media/' + assetId + ')', 'https://staging.fabelpad.nl'));
  assert.throws(() => markdownToBlogContent('a'.repeat(192 * 1024 + 1)));
});

test('machine imports preserve omitted fields and slug, allow explicit image clearing and require a base revision', () => {
  const original = { ...document(), hero: { assetId, alt: 'Vos', focalPoint: { x: .2, y: .7 } }, seo: { title: 'Zoektitel', description: 'Bestaande omschrijving' } };
  const updated = markdownToBlogDocument({ ...request(), baseRevision: 4, title: 'Gewijzigde titel', seo: { title: 'Nieuwe zoektitel' } }, { authorId, origin: 'https://staging.fabelpad.nl', current: original });
  assert.equal(updated.slug, original.slug); assert.deepEqual(updated.hero, original.hero); assert.equal(updated.seo.description, original.seo.description);
  const clear = markdownToBlogDocument({ ...request(), hero: null, ogImageAssetId: null }, { authorId, current: original }); assert.equal(clear.hero, null);
  const newHero = markdownToBlogDocument({ ...request(), hero: { assetId, alt: 'Nieuwe vos' } }, { authorId }); assert.deepEqual(newHero.hero.focalPoint, { x: .5, y: .5 });
  for (const patch of [{ baseRevision: undefined }, { baseRevision: '4' }, { baseRevision: 0 }, { arbitrary: true }, { seo: null }, { slug: null }, { content: { format: 'html', body: '<p>test</p>' } }]) assert.throws(() => markdownToBlogDocument({ ...request(), ...patch }, { authorId }));
});

test('SEO uses live data, a distinct staging public URL, broad image fallback and safe JSON-LD serialization', () => {
  const asset = id => ({ assetId: id, mimeType: 'image/png', width: id === ogId ? 1200 : 800, height: id === ogId ? 630 : 1000, url: `https://staging.fabelpad.nl/api/blog/media/${id}` });
  const article = { postId: authorId, revision: 4, document: { ...document(), type: 'article', hero: { assetId, alt: 'Vos bij de boom', focalPoint: { x: .4, y: .7 } }, ogImageAssetId: ogId }, author: { id: authorId, name: 'Robin' }, category: { id: assetId, name: 'Samen lezen' }, assets: [asset(assetId), asset(ogId)], publicUrl: 'https://staging.fabelpad.nl/blog/samen-op-avontuur', canonicalUrl: 'https://fabelpad.nl/blog/samen-op-avontuur', publishedAt: '2026-11-26T12:00:00Z', updatedAt: '2026-11-26T13:00:00Z' };
  const metadata = blogArticleMetadata(article, false); assert.equal(metadata.alternates.canonical, article.canonicalUrl); assert.deepEqual(metadata.robots, { index: false, follow: false }); assert.equal(metadata.openGraph.images[0].url, asset(ogId).url); assert.equal(metadata.twitter.card, 'summary_large_image');
  const schema = blogStructuredData(article); assert.equal(schema['@type'], 'Article'); assert.equal(schema.author.name, 'Robin'); assert.equal(schema.dateModified, article.updatedAt); assert.equal(schema.url, article.canonicalUrl);
  const fallback = blogArticleMetadata({ ...article, document: { ...article.document, ogImageAssetId: null } }, true); assert.equal(fallback.openGraph.images[0].url, asset(assetId).url); assert.equal(fallback.robots.index, true);
  const dangerous = { text: '</script><script>alert(1)</script>\u2028\u2029' }, encoded = serializeBlogJsonLd(dangerous); assert.ok(!encoded.includes('<')); assert.deepEqual(JSON.parse(encoded), dangerous);
  verifyBlogIdentity(blogSite('staging'), 'tlwfpivafcokcjyjwgmq');
  assert.throws(() => verifyBlogIdentity(blogSite('staging'), 'aptprpkosqctwrzeetgs')); assert.throws(() => verifyBlogIdentity({ ...blogSite('staging'), origin: 'https://evil.invalid' }, 'tlwfpivafcokcjyjwgmq'));
});
