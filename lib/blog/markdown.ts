import MarkdownIt, { type Token } from 'markdown-it';
import type { BlogContent, BlogDocument, BlogNode } from './types.ts';
import { BlogValidationError, emptyBlogDocument, isBlogUuid, normalizeSlug, safeBlogLink, validateBlogContent, validateBlogDocument } from './document.ts';

const parser = new MarkdownIt({ html: false, linkify: false, typographer: false, breaks: false });
type Mark = NonNullable<BlogNode['marks']>[number];
function imageId(source: string, origin?: string): string {
  const direct = /^asset:([0-9a-f-]{36})$/iu.exec(source)?.[1];
  if (direct && isBlogUuid(direct)) return direct;
  let url: URL; try { url = new URL(source, origin || 'https://fabelpad.nl'); } catch { throw new BlogValidationError('INVALID_CONTENT', 'Gebruik een eigen geüploade afbeelding.'); }
  const id = /^\/api\/blog\/media\/([0-9a-f-]{36})$/iu.exec(url.pathname)?.[1];
  if (id && isBlogUuid(id) && url.origin === (origin || 'https://fabelpad.nl') && !url.search && !url.hash) return id;
  throw new BlogValidationError('INVALID_CONTENT', 'Gebruik asset:assetId voor een geüploade inline afbeelding.');
}
function inline(tokens: Token[], origin?: string): BlogNode[] {
  const result: BlogNode[] = [], marks: Mark[] = [];
  for (const token of tokens) {
    const mark = ({ strong_open: 'bold', em_open: 'italic', s_open: 'strike' } as Record<string, string>)[token.type];
    if (mark) { marks.push({ type: mark }); continue; }
    if (['strong_close', 'em_close', 's_close', 'link_close'].includes(token.type)) { marks.pop(); continue; }
    if (token.type === 'link_open') { marks.push({ type: 'link', attrs: { href: safeBlogLink(token.attrGet('href')), ...(token.attrGet('title') ? { title: token.attrGet('title') } : {}) } }); continue; }
    if (token.type === 'image') { result.push({ type: 'image', attrs: { assetId: imageId(String(token.attrGet('src') || ''), origin), alt: token.content } }); continue; }
    if (token.type === 'hardbreak') { result.push({ type: 'hardBreak' }); continue; }
    const value = token.type === 'softbreak' ? '\n' : token.content;
    if (value) result.push({ type: 'text', text: value, ...(marks.length || token.type === 'code_inline' ? { marks: [...marks, ...(token.type === 'code_inline' ? [{ type: 'code' }] : [])] } : {}) });
  }
  return result;
}

/** Markdown is parsed to the same constrained JSON tree as the local editor.
 * Raw HTML is literal text. No HTML execution or arbitrary image URL survives. */
export function markdownToBlogContent(markdown: string, origin?: string): BlogContent {
  if (typeof markdown !== 'string' || new TextEncoder().encode(markdown).byteLength > 192 * 1024) throw new BlogValidationError('INVALID_CONTENT', 'De Markdown-inhoud is te groot.');
  const root: BlogNode = { type: 'doc', content: [] }, stack: BlogNode[] = [root];
  const append = (node: BlogNode) => { stack.at(-1)!.content!.push(node); };
  for (const token of parser.parse(markdown, {})) {
    if (['thead_open', 'thead_close', 'tbody_open', 'tbody_close'].includes(token.type)) continue;
    const mapping: Record<string, string> = { paragraph_open: 'paragraph', heading_open: 'heading', bullet_list_open: 'bulletList', ordered_list_open: 'orderedList', list_item_open: 'listItem', blockquote_open: 'blockquote', table_open: 'table', tr_open: 'tableRow', th_open: 'tableHeader', td_open: 'tableCell' };
    if (mapping[token.type]) {
      const type = mapping[token.type], next: BlogNode = { type, content: [] };
      if (type === 'heading') next.attrs = { level: Math.max(2, Math.min(4, Number(token.tag.slice(1)))) };
      if (type === 'orderedList') next.attrs = { start: Number(token.attrGet('start') || 1) };
      append(next); stack.push(next); continue;
    }
    if (token.nesting === -1) { if (stack.length > 1) stack.pop(); continue; }
    if (token.type === 'inline') {
      const children = inline(token.children || [], origin);
      if (['tableHeader', 'tableCell'].includes(stack.at(-1)!.type)) { append({ type: 'paragraph', content: children }); continue; }
      // TipTap images are block nodes: split any surrounding Markdown paragraph.
      const current = stack.at(-1)!;
      if (current.type === 'paragraph' && children.some(child => child.type === 'image')) {
        const parent = stack.at(-2)!; parent.content!.pop();
        let paragraph: BlogNode = { type: 'paragraph', content: [] };
        for (const child of children) {
          if (child.type === 'image') { if (paragraph.content!.length) parent.content!.push(paragraph); parent.content!.push(child); paragraph = { type: 'paragraph', content: [] }; }
          else paragraph.content!.push(child);
        }
        if (paragraph.content!.length) parent.content!.push(paragraph);
      } else current.content!.push(...children);
      continue;
    }
    if (token.type === 'hr') append({ type: 'horizontalRule' });
    else if (['fence', 'code_block'].includes(token.type)) append({ type: 'codeBlock', attrs: { language: token.info.trim().split(/\s/u)[0] || null }, content: token.content ? [{ type: 'text', text: token.content }] : [] });
    else if (token.content) append({ type: 'paragraph', content: [{ type: 'text', text: token.content }] });
  }
  if (!root.content!.length) root.content!.push({ type: 'paragraph', content: [] });
  return validateBlogContent(root);
}

export type MarkdownDefaults = { authorId: string; slug?: string; origin?: string; current?: BlogDocument | null };
export function markdownToBlogDocument(input: unknown, defaults: MarkdownDefaults): BlogDocument {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BlogValidationError('INVALID_CONTENT', 'Lever een geldig artikel aan.');
  const value = input as Record<string, unknown>;
  const allowed = ['baseRevision', 'type', 'locale', 'title', 'content', 'slug', 'excerpt', 'authorId', 'categoryId', 'tags', 'seo', 'hero', 'ogImageAssetId'];
  if (Object.keys(value).some(key => !allowed.includes(key)) || !Object.hasOwn(value, 'baseRevision') || value.baseRevision !== null && (!Number.isSafeInteger(value.baseRevision) || Number(value.baseRevision) < 1)) throw new BlogValidationError('INVALID_CONTENT', 'baseRevision is verplicht en moet de actuele revisie zijn.');
  const content = value.content as Record<string, unknown> | null;
  if (!content || typeof content !== 'object' || content.format !== 'markdown' || typeof content.body !== 'string' || Object.keys(content).some(key => !['format', 'body'].includes(key))) throw new BlogValidationError('INVALID_CONTENT', 'Lever content aan als Markdown.');
  const base = defaults.current || emptyBlogDocument(defaults.authorId);
  const title = typeof value.title === 'string' ? value.title : '';
  const seo = value.seo === undefined ? base.seo : value.seo && typeof value.seo === 'object' && !Array.isArray(value.seo) ? { ...base.seo, ...value.seo } : value.seo;
  const hero = value.hero === undefined ? base.hero : value.hero && typeof value.hero === 'object' && !Array.isArray(value.hero) ? { focalPoint: { x: .5, y: .5 }, ...value.hero } : value.hero;
  return validateBlogDocument({
    ...base, ...Object.fromEntries(Object.entries(value).filter(([key]) => !['baseRevision', 'content'].includes(key))),
    title, slug: value.slug === undefined ? defaults.slug ?? (base.slug || normalizeSlug(title)) : value.slug,
    seo, hero,
    content: markdownToBlogContent(content.body, defaults.origin),
  });
}
