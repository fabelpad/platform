import { createElement, Fragment, type ReactNode } from 'react';
import type { BlogAsset, BlogContent, BlogNode } from '../../lib/blog/types';
import { safeBlogLink, validateBlogContent } from '../../lib/blog/document';

export default function BlogRichText({ document, assets }: { document: BlogContent; assets: BlogAsset[] }) {
  const content = validateBlogContent(document);
  function render(node: BlogNode, key: string): ReactNode {
    const children = node.content?.map((child, index) => render(child, `${key}-${index}`));
    if (node.type === 'text') {
      let text: ReactNode = node.text;
      for (const [index, mark] of (node.marks || []).entries()) {
        const markKey = `${key}-m${index}`;
        const tag = ({ bold: 'strong', italic: 'em', underline: 'u', strike: 's', code: 'code' } as Record<string, string>)[mark.type];
        if (tag) text = createElement(tag, { key: markKey }, text);
        else if (mark.type === 'highlight') text = <mark key={markKey} style={mark.attrs?.color ? { backgroundColor: String(mark.attrs.color) } : undefined}>{text}</mark>;
        else if (mark.type === 'link') text = <a key={markKey} href={safeBlogLink(mark.attrs?.href)} target="_blank" rel="noopener noreferrer" title={typeof mark.attrs?.title === 'string' ? mark.attrs.title : undefined}>{text}</a>;
      }
      return <Fragment key={key}>{text}</Fragment>;
    }
    if (node.type === 'doc') return <Fragment key={key}>{children}</Fragment>;
    if (node.type === 'heading') return createElement(`h${node.attrs!.level}`, { key }, children);
    if (node.type === 'hardBreak') return <br key={key} />;
    if (node.type === 'horizontalRule') return <hr key={key} />;
    if (node.type === 'image') {
      const asset = assets.find(item => item.assetId === node.attrs?.assetId);
      return asset ? <figure key={key}><img src={asset.url} alt={String(node.attrs!.alt)} width={asset.width} height={asset.height} loading="lazy" decoding="async" /></figure> : null;
    }
    if (node.type === 'table') return <div className="fp-blog-table-scroll" key={key} role="region" aria-label="Tabel in het artikel" tabIndex={0}><table><tbody>{children}</tbody></table></div>;
    if (['tableHeader', 'tableCell'].includes(node.type)) return createElement(node.type === 'tableHeader' ? 'th' : 'td', { key, colSpan: Number(node.attrs?.colspan || 1), rowSpan: Number(node.attrs?.rowspan || 1) }, children);
    if (node.type === 'orderedList') return <ol key={key} start={Number(node.attrs?.start || 1)}>{children}</ol>;
    if (node.type === 'codeBlock') return <pre key={key}><code>{children}</code></pre>;
    const tag = ({ paragraph: 'p', bulletList: 'ul', listItem: 'li', blockquote: 'blockquote', tableRow: 'tr' } as Record<string, string>)[node.type];
    return tag ? createElement(tag, { key }, children) : null;
  }
  return <div className="fp-blog-prose">{render(content, 'doc')}</div>;
}
