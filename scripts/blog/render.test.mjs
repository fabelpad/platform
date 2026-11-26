import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compileSource } from '../source-test-loader.mjs';
const temporary = await mkdtemp(path.join(tmpdir(), 'fabelpad-blog-render-'));
await symlink(new URL('../../node_modules', import.meta.url).pathname, path.join(temporary, 'node_modules'));
const validator = await compileSource(new URL('../../lib/blog/document.ts', import.meta.url), temporary);
async function component(name, replacements) {
  const source = await readFile(new URL(`../../src/blog/${name}.tsx`, import.meta.url), 'utf8');
  let code = ts.transpileModule(source, { fileName: `${name}.tsx`, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  for (const [specifier, replacement] of Object.entries(replacements)) code = code.replaceAll(`'${specifier}'`, JSON.stringify(replacement));
  const destination = pathToFileURL(path.join(temporary, `${name}.mjs`)); await writeFile(destination, code); return destination.href;
}
const richURL = await component('BlogRichText', { '../../lib/blog/document': validator });
// Only the site chrome is stubbed; the real article and JSON renderer are rendered
// by React's server renderer. Full Next HTML/headers are checked after staging deploy.
const shellURL = pathToFileURL(path.join(temporary, 'Shell.mjs')); await writeFile(shellURL, 'export default function Shell({children}){return children;}');
const articleURL = await component('BlogArticleView', { './BlogShell': shellURL.href, './BlogRichText': richURL });
const { default: RichText } = await import(richURL), { default: Article } = await import(articleURL);
const { emptyBlogDocument } = await import(validator);
after(() => rm(temporary, { recursive: true, force: true }));
const assetId = '11111111-1111-4111-8111-111111111111', postId = '22222222-2222-4222-8222-222222222222';
const text = value => ({ type: 'paragraph', content: [{ type: 'text', text: value }] });
const content = { type: 'doc', content: [ { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Samen lezen' }] }, text('<script>niet uitvoeren</script>'), { type: 'image', attrs: { assetId, alt: 'Vos & boom' } }, { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [text('Naam')] }, { type: 'tableCell', content: [text('Vos')] }] }] }, { type: 'blockquote', content: [text('Een mooi verhaal.')] }, { type: 'paragraph', content: [{ type: 'text', text: 'Veilige link', marks: [{ type: 'bold' }, { type: 'underline' }, { type: 'link', attrs: { href: 'https://fabelpad.nl/lezen' } }] }] } ] };
const assets = [{ assetId, mimeType: 'image/png', width: 800, height: 1000, url: `https://staging.fabelpad.nl/api/blog/media/${assetId}` }];
const article = { postId, revision: 4, document: { ...emptyBlogDocument(postId), title: 'Samen <avonturen> lezen', slug: 'samen-lezen', excerpt: 'Een voorbeeld voor ouders.', content, hero: { assetId, alt: 'Een vos bij de boom', focalPoint: { x: .25, y: .75 } }, tags: ['voorlezen'] }, author: { id: postId, name: 'Redactie Fabelpad' }, category: { id: postId, name: 'Leesideeën' }, assets, publishedAt: '2026-11-25T12:00:00Z', updatedAt: '2026-11-26T12:00:00Z', publicUrl: 'https://staging.fabelpad.nl/blog/samen-lezen', canonicalUrl: 'https://fabelpad.nl/blog/samen-lezen' };

test('actual public article renders one H1, editorial H2, real author/date and responsive image focus/proof', () => {
  const html = renderToStaticMarkup(createElement(Article, { article, proof: 'opaque-publication-proof' }));
  assert.equal((html.match(/<h1(?:>| )/gu) || []).length, 1); assert.ok(html.includes('<h2>Samen lezen</h2>')); assert.ok(html.includes('Redactie Fabelpad')); assert.ok(html.includes('dateTime="2026-11-25T12:00:00Z"')); assert.ok(html.includes('Bijgewerkt op'));
  assert.ok(html.includes('object-position:25% 75%')); assert.ok(html.includes('alt="Een vos bij de boom"')); assert.ok(html.includes(`data-blog-revision="${postId}:4"`)); assert.ok(html.includes('data-blog-proof="opaque-publication-proof"'));
  assert.ok(html.includes('Samen &lt;avonturen&gt; lezen')); assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;niet uitvoeren&lt;/script&gt;'));
  assert.ok(html.includes('<table>')); assert.ok(html.includes('aria-label="Tabel in het artikel"')); assert.ok(html.includes('rel="noopener noreferrer"'));
});

test('private preview uses the real article renderer but has no publication proof or public publication date', () => {
  const html = renderToStaticMarkup(createElement(Article, { article, preview: true })); assert.ok(html.includes('Afgeschermd voorbeeld')); assert.ok(html.includes('alleen zichtbaar voor bevoegde beheerders')); assert.ok(!html.includes('data-blog-proof')); assert.ok(!html.includes('<time')); assert.ok(html.includes('href="/studio/blog"'));
});

test('server renderer refuses malicious structured content instead of rendering arbitrary HTML or image URLs', () => {
  for (const node of [{ type: 'iframe', attrs: { src: 'https://evil.invalid' } }, { type: 'image', attrs: { assetId, alt: 'Vos', src: 'https://evil.invalid' } }, { type: 'paragraph', content: [{ type: 'text', text: 'klik', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }] }] }]) assert.throws(() => renderToStaticMarkup(createElement(RichText, { document: { type: 'doc', content: [node] }, assets })));
});
