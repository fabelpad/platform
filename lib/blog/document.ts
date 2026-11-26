import type { BlogContent, BlogDocument, BlogNode } from './types.ts';

export class BlogValidationError extends Error {
  readonly status = 422;
  constructor(readonly code: string, message: string, readonly fieldErrors: Record<string, string> = {}) { super(message); }
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export const isBlogUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
function invalid(field: string, message: string): never { throw new BlogValidationError('INVALID_CONTENT', message, { [field]: message }); }
function keys(value: Record<string, unknown>, allowed: string[], field: string) {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid(field, 'Dit onderdeel bevat niet ondersteunde velden.');
}
function text(value: unknown, field: string, max: number, required = false, label = field): string {
  if (typeof value !== 'string' || value.length > max || value.includes('\0') || required && !value.trim()) invalid(field, `Vul ${label} in (maximaal ${max} tekens).`);
  return value.trim();
}
export function normalizeSlug(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/gu, '').toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 120).replace(/-$/u, '');
}
export function safeBlogLink(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 2048 || /[\u0000-\u0020\u007f\\]/u.test(value) || /%0[ad]/iu.test(value)) invalid('content', 'Gebruik een veilige http-, https- of e-maillink.');
  if (/^\/[a-z0-9_?=#%./&+~-]*$/iu.test(value) && !value.startsWith('//')) return value;
  if (/^#[a-z0-9_-]+$/iu.test(value)) return value;
  let url: URL; try { url = new URL(value); } catch { return invalid('content', 'Deze link is niet geldig.'); }
  if (!['https:', 'http:', 'mailto:'].includes(url.protocol) || url.username || url.password || url.protocol !== 'mailto:' && !url.hostname) invalid('content', 'Dit linkprotocol is niet toegestaan.');
  return value;
}

export function validateBlogContent(value: unknown): BlogContent {
  let count = 0, characters = 0;
  function node(input: unknown, depth: number, parent: string): BlogNode {
    if (!record(input) || depth > 20 || ++count > 5000 || typeof input.type !== 'string') return invalid('content', 'De artikelinhoud is te groot of ongeldig.');
    keys(input, ['type', 'attrs', 'marks', 'content', 'text'], 'content');
    const type = input.type;
    const allowed = ['doc', 'paragraph', 'heading', 'text', 'hardBreak', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'horizontalRule', 'image', 'table', 'tableRow', 'tableHeader', 'tableCell', 'codeBlock'];
    if (!allowed.includes(type) || type === 'doc' && depth !== 0 || depth === 0 && type !== 'doc') return invalid('content', 'Dit editoronderdeel wordt niet ondersteund.');
    const inline = ['text', 'hardBreak'];
    if (['paragraph', 'heading', 'codeBlock'].includes(parent) && !inline.includes(type)) return invalid('content', 'Gebruik tekst binnen een alinea of kop.');
    if (inline.includes(type) && !['paragraph', 'heading', 'codeBlock'].includes(parent)) return invalid('content', 'Tekst hoort binnen een alinea of kop.');
    if (['bulletList', 'orderedList'].includes(parent) && type !== 'listItem' || type === 'listItem' && !['bulletList', 'orderedList'].includes(parent)) return invalid('content', 'Deze lijst is niet geldig.');
    if (parent === 'table' && type !== 'tableRow' || type === 'tableRow' && parent !== 'table' || parent === 'tableRow' && !['tableCell', 'tableHeader'].includes(type) || ['tableCell', 'tableHeader'].includes(type) && parent !== 'tableRow') return invalid('content', 'Deze tabel is niet geldig.');
    const result: BlogNode = { type };
    if (type === 'text') {
      if (typeof input.text !== 'string' || !input.text || input.text.includes('\0')) return invalid('content', 'Deze tekst is niet geldig.');
      characters += input.text.length; if (characters > 120_000) return invalid('content', 'Het artikel bevat te veel tekst.');
      result.text = input.text;
    } else if (input.text !== undefined) return invalid('content', 'Onverwachte tekst in de editorinhoud.');
    const attrs = input.attrs === undefined ? {} : input.attrs;
    if (!record(attrs)) return invalid('content', 'Deze editorinstellingen zijn niet geldig.');
    if (type === 'heading') {
      keys(attrs, ['level'], 'content');
      if (typeof attrs.level !== 'number' || ![2, 3, 4].includes(attrs.level)) return invalid('content', 'Gebruik een kop vanaf H2 tot en met H4.');
      result.attrs = { level: attrs.level };
    } else if (type === 'orderedList') {
      keys(attrs, ['start', 'type'], 'content');
      const start = attrs.start ?? 1;
      if (!Number.isInteger(start) || Number(start) < 1 || Number(start) > 1_000_000 || attrs.type != null && attrs.type !== '1') return invalid('content', 'Deze nummering is niet geldig.');
      result.attrs = { start };
    } else if (type === 'image') {
      keys(attrs, ['assetId', 'alt'], 'content');
      if (!isBlogUuid(attrs.assetId)) return invalid('content', 'Kies een afbeelding uit de eigen mediabibliotheek.');
      result.attrs = { assetId: attrs.assetId, alt: text(attrs.alt, 'alt-tekst', 500, true) };
    } else if (['tableCell', 'tableHeader'].includes(type)) {
      keys(attrs, ['colspan', 'rowspan', 'colwidth'], 'content');
      const colspan = attrs.colspan ?? 1, rowspan = attrs.rowspan ?? 1, colwidth = attrs.colwidth ?? null;
      if (!Number.isInteger(colspan) || Number(colspan) < 1 || Number(colspan) > 12 || !Number.isInteger(rowspan) || Number(rowspan) < 1 || Number(rowspan) > 100 || colwidth !== null && (!Array.isArray(colwidth) || colwidth.length > 12 || colwidth.some(width => !Number.isInteger(width) || width < 1 || width > 2000))) return invalid('content', 'De celafmetingen zijn niet geldig.');
      result.attrs = { colspan, rowspan, colwidth };
    } else if (type === 'codeBlock') {
      keys(attrs, ['language'], 'content');
      if (attrs.language != null && (typeof attrs.language !== 'string' || !/^[a-z0-9+-]{0,32}$/iu.test(attrs.language))) return invalid('content', 'Deze codetaal is niet geldig.');
      result.attrs = { language: attrs.language ?? null };
    } else keys(attrs, [], 'content');
    if (input.marks !== undefined) {
      if (type !== 'text' || !Array.isArray(input.marks) || input.marks.length > 8) return invalid('content', 'Deze tekstopmaak is niet geldig.');
      result.marks = input.marks.map(mark => {
        if (!record(mark) || typeof mark.type !== 'string' || !['bold', 'italic', 'underline', 'strike', 'code', 'highlight', 'link'].includes(mark.type)) return invalid('content', 'Deze tekstopmaak is niet ondersteund.');
        keys(mark, ['type', 'attrs'], 'content');
        const attributes = mark.attrs ?? {}; if (!record(attributes)) return invalid('content', 'Deze opmaakinstellingen zijn niet geldig.');
        if (mark.type === 'link') {
          keys(attributes, ['href', 'title', 'target', 'rel', 'class'], 'content');
          if (attributes.class != null || attributes.target != null && !['_blank', '_self'].includes(String(attributes.target))) return invalid('content', 'Deze linkinstellingen zijn niet toegestaan.');
          return { type: 'link', attrs: { href: safeBlogLink(attributes.href), target: '_blank', rel: 'noopener noreferrer', ...(attributes.title ? { title: text(attributes.title, 'linktitel', 200) } : {}) } };
        }
        if (mark.type === 'highlight') {
          keys(attributes, ['color'], 'content');
          if (attributes.color != null && (typeof attributes.color !== 'string' || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/iu.test(attributes.color))) return invalid('content', 'Kies een geldige markeerkleur.');
          return { type: 'highlight', ...(attributes.color ? { attrs: { color: attributes.color } } : {}) };
        }
        keys(attributes, [], 'content'); return { type: mark.type };
      });
      if (new Set(result.marks.map(mark => mark.type)).size !== result.marks.length) return invalid('content', 'Dubbele tekstopmaak is niet toegestaan.');
    }
    const leaves = ['text', 'hardBreak', 'horizontalRule', 'image'];
    if (leaves.includes(type)) { if (input.content !== undefined) return invalid('content', 'Dit onderdeel kan geen subinhoud bevatten.'); }
    else {
      if (input.content !== undefined && !Array.isArray(input.content)) return invalid('content', 'De artikelstructuur is niet geldig.');
      result.content = (Array.isArray(input.content) ? input.content : []).map(child => node(child, depth + 1, type));
      if (['doc', 'bulletList', 'orderedList', 'listItem', 'table', 'tableRow', 'tableHeader', 'tableCell'].includes(type) && !result.content.length) return invalid('content', 'Dit editoronderdeel heeft inhoud nodig.');
      if (type === 'listItem' && result.content[0].type !== 'paragraph') return invalid('content', 'Een lijstitem begint met een alinea.');
    }
    return result;
  }
  const content = node(value, 0, '');
  if (new TextEncoder().encode(JSON.stringify(content)).byteLength > 256 * 1024) return invalid('content', 'De artikelinhoud is te groot.');
  return content as BlogContent;
}

export function emptyBlogDocument(authorId: string): BlogDocument {
  return { type: 'blog', locale: 'nl-NL', title: '', slug: '', excerpt: '', authorId, categoryId: null, tags: [], content: { type: 'doc', content: [{ type: 'paragraph', content: [] }] }, seo: { title: '', description: '' }, hero: null, ogImageAssetId: null };
}
export function validateBlogDocument(value: unknown): BlogDocument {
  if (!record(value)) return invalid('document', 'Vul een geldig artikel in.');
  keys(value, ['type', 'locale', 'title', 'slug', 'excerpt', 'authorId', 'categoryId', 'tags', 'content', 'seo', 'hero', 'ogImageAssetId'], 'document');
  if (!['blog', 'article'].includes(String(value.type))) return invalid('type', 'Kies blog of artikel.');
  if (value.locale !== 'nl-NL') return invalid('locale', 'Deze website ondersteunt Nederlands (nl-NL).');
  const title = text(value.title, 'title', 200, true, 'een titel'), slug = text(value.slug, 'slug', 120, true);
  if (slug !== normalizeSlug(slug) || !slug) return invalid('slug', 'Gebruik kleine letters, cijfers en enkele koppeltekens.');
  if (!isBlogUuid(value.authorId)) return invalid('authorId', 'Kies een auteur uit het CMS.');
  if (value.categoryId !== null && !isBlogUuid(value.categoryId)) return invalid('categoryId', 'Kies een geldige categorie.');
  if (!Array.isArray(value.tags) || value.tags.length > 15 || value.tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.length > 50)) return invalid('tags', 'Gebruik maximaal vijftien tags van maximaal vijftig tekens.');
  if (!record(value.seo)) return invalid('seo', 'Vul geldige SEO-gegevens in.');
  keys(value.seo, ['title', 'description'], 'seo');
  let hero: BlogDocument['hero'] = null;
  if (value.hero !== null) {
    if (!record(value.hero)) return invalid('hero', 'Kies een geldige hoofdafbeelding.');
    keys(value.hero, ['assetId', 'alt', 'focalPoint'], 'hero');
    if (!isBlogUuid(value.hero.assetId) || !record(value.hero.focalPoint)) return invalid('hero', 'Kies een afbeelding uit de mediabibliotheek en een focuspunt.');
    keys(value.hero.focalPoint, ['x', 'y'], 'hero');
    const { x, y } = value.hero.focalPoint;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return invalid('hero', 'Het focuspunt ligt tussen 0 en 1.');
    hero = { assetId: value.hero.assetId, alt: text(value.hero.alt, 'hero.alt', 500, true, 'alt-tekst'), focalPoint: { x, y } };
  }
  if (value.ogImageAssetId !== null && !isBlogUuid(value.ogImageAssetId)) return invalid('ogImageAssetId', 'Kies een geldige deelafbeelding.');
  return { type: value.type as BlogDocument['type'], locale: 'nl-NL', title, slug, excerpt: text(value.excerpt, 'excerpt', 600, false, 'een samenvatting'), authorId: value.authorId, categoryId: value.categoryId, tags: [...new Set(value.tags.map(tag => tag.trim()))], content: validateBlogContent(value.content), seo: { title: text(value.seo.title, 'seo.title', 200, false, 'een SEO-titel'), description: text(value.seo.description, 'seo.description', 320, false, 'een metaomschrijving') }, hero, ogImageAssetId: value.ogImageAssetId };
}
export function blogContentAssetIds(content: BlogContent): string[] {
  const ids = new Set<string>();
  function walk(node: BlogNode) { if (node.type === 'image' && typeof node.attrs?.assetId === 'string') ids.add(node.attrs.assetId); node.content?.forEach(walk); }
  walk(content); return [...ids];
}
