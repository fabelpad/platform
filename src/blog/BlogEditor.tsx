'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, Node, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { TableCell, TableHeader, TableKit } from '@tiptap/extension-table';
import type { BlogAsset, BlogContent } from '../../lib/blog/types';
import { safeBlogLink } from '../../lib/blog/document';

type Props = { value: BlogContent; assets: BlogAsset[]; disabled?: boolean; onChange: (content: BlogContent) => void };
const safeLink = (href: string) => { try { safeBlogLink(href); return true; } catch { return false; } };

function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={onClick}>{children}</button>;
}

function Formatting({ editor, compact = false }: { editor: Editor; compact?: boolean }) {
  const current = useEditorState({ editor, selector: ({ editor: e }) => ({ bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), highlight: e.isActive('highlight'), bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), quote: e.isActive('blockquote'), table: e.isActive('table'), undo: e.can().undo(), redo: e.can().redo(), heading: [2, 3, 4].find(level => e.isActive('heading', { level })) || 0 }) });
  return <><Tool label="Vet (Ctrl+B)" active={current.bold} onClick={() => editor.chain().focus().toggleBold().run()}><strong>B</strong></Tool><Tool label="Cursief (Ctrl+I)" active={current.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><em>I</em></Tool><Tool label="Onderstrepen (Ctrl+U)" active={current.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><u>U</u></Tool><Tool label="Markeren" active={current.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>▰</Tool>{!compact && <><label className="blog-block-select"><span className="blog-sr-only">Tekststijl</span><select aria-label="Tekststijl" value={current.heading} onChange={event => { const level = Number(event.target.value); if (level) editor.chain().focus().setHeading({ level: level as 2 | 3 | 4 }).run(); else editor.chain().focus().setParagraph().run(); }}><option value="0">Alinea</option><option value="2">Kop 2</option><option value="3">Kop 3</option><option value="4">Kop 4</option></select></label><Tool label="Opsomming" active={current.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>• Lijst</Tool><Tool label="Genummerde lijst" active={current.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. Lijst</Tool><Tool label="Citaat" active={current.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>“ ”</Tool><Tool label="Horizontale lijn" onClick={() => editor.chain().focus().setHorizontalRule().run()}>―</Tool><Tool label="Tabel invoegen" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Tabel</Tool><Tool label="Ongedaan maken" disabled={!current.undo} onClick={() => editor.chain().focus().undo().run()}>↶</Tool><Tool label="Opnieuw uitvoeren" disabled={!current.redo} onClick={() => editor.chain().focus().redo().run()}>↷</Tool></>}</>;
}

export default function BlogEditor({ value, assets, disabled = false, onChange }: Props) {
  const assetMap = useRef(new Map<string, BlogAsset>()); assetMap.current = new Map(assets.map(asset => [asset.assetId, asset]));
  const onUpdate = useRef(onChange); onUpdate.current = onChange;
  const [linkOpen, setLinkOpen] = useState(false), [link, setLink] = useState(''), [linkError, setLinkError] = useState('');
  const [imageOpen, setImageOpen] = useState(false), [imageId, setImageId] = useState(''), [imageAlt, setImageAlt] = useState('');
  const [slash, setSlash] = useState(false);
  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [2, 3, 4] }, link: { openOnClick: false, autolink: false, linkOnPaste: false, isAllowedUri: safeLink, HTMLAttributes: { rel: 'noopener noreferrer' } } }),
    Highlight.configure({ multicolor: false }), TableKit.configure({ table: { resizable: false }, tableCell: false, tableHeader: false }),
    // Keep the editor's persisted schema equal to the shared server contract.
    // TipTap 3.35 adds align:null; this site only stores spans and column widths.
    TableCell.extend({ addAttributes() { return Object.fromEntries(Object.entries(this.parent?.() || {}).filter(([name]) => ['colspan', 'rowspan', 'colwidth'].includes(name))); } }),
    TableHeader.extend({ addAttributes() { return Object.fromEntries(Object.entries(this.parent?.() || {}).filter(([name]) => ['colspan', 'rowspan', 'colwidth'].includes(name))); } }),
    Node.create({ name: 'image', group: 'block', atom: true, draggable: true,
      addAttributes: () => ({ assetId: { default: null }, alt: { default: '' } }),
      parseHTML: () => [{ tag: 'img[data-blog-asset]', getAttrs: element => { const id = element.getAttribute('data-blog-asset'); return id && assetMap.current.has(id) ? { assetId: id, alt: element.getAttribute('alt') || '' } : false; } }],
      renderHTML: ({ node }) => { const asset = assetMap.current.get(String(node.attrs.assetId)); return ['img', { 'data-blog-asset': node.attrs.assetId, src: asset?.url || undefined, alt: node.attrs.alt, width: asset?.width, height: asset?.height }]; },
    }),
  ], []);
  const editor = useEditor({ extensions, content: value, editable: !disabled, immediatelyRender: false, editorProps: { attributes: { class: 'blog-prose blog-editor-content', role: 'textbox', 'aria-label': 'Artikelinhoud', 'aria-multiline': 'true', spellcheck: 'true' }, handleKeyDown: (_view, event) => { if (event.key === 'Escape') { setSlash(false); return false; } return false; } }, onUpdate: ({ editor: current }) => { onUpdate.current(current.getJSON() as BlogContent); setSlash(current.state.selection.$from.parent.textContent === '/'); } });
  const selection = useEditorState({ editor, selector: ({ editor: current }) => ({ table: current?.isActive('table') || false, link: current?.isActive('link') || false }) });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  if (!editor) return <p role="status">Teksteditor laden…</p>;
  function block(command: 'paragraph' | 'heading' | 'bullet' | 'table') {
    const chain = editor!.chain().focus();
    if (slash) { const { $from } = editor!.state.selection; chain.deleteRange({ from: $from.start(), to: $from.end() }); }
    if (command === 'heading') chain.setHeading({ level: 2 }).run();
    else if (command === 'bullet') chain.toggleBulletList().run();
    else if (command === 'table') chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    else chain.setParagraph().run();
    setSlash(false);
  }
  return <div className={`blog-editor${disabled ? ' blog-editor-disabled' : ''}`}>
    <div className="blog-editor-toolbar" role="toolbar" aria-label="Tekstopmaak"><Formatting editor={editor} /><Tool label="Link toevoegen of aanpassen" active={selection?.link} onClick={() => { setLink(String(editor.getAttributes('link').href || '')); setLinkError(''); setLinkOpen(value => !value); }}>Link</Tool><Tool label="Afbeelding uit mediabibliotheek" onClick={() => setImageOpen(value => !value)}>Afbeelding</Tool></div>
    {linkOpen && <div className="blog-editor-insert"><label>Linkadres<input type="text" value={link} onChange={event => setLink(event.target.value)} placeholder="https://…" /></label><button type="button" className="account-secondary" onClick={() => { if (!safeLink(link.trim())) { setLinkError('Gebruik een volledig http(s)-adres, e-mailadres met mailto:, of een lokaal pad.'); return; } editor.chain().focus().extendMarkRange('link').setLink({ href: link.trim() }).run(); setLinkOpen(false); }}>Link toepassen</button><button type="button" className="account-secondary" onClick={() => { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }}>Link verwijderen</button>{linkError && <p role="alert">{linkError}</p>}</div>}
    {imageOpen && <div className="blog-editor-insert"><label>Afbeelding<select value={imageId} onChange={event => setImageId(event.target.value)}><option value="">Kies een afbeelding</option>{assets.map(asset => <option key={asset.assetId} value={asset.assetId}>{asset.originalName || asset.assetId} ({asset.width} × {asset.height})</option>)}</select></label><label>Beschrijving van de afbeelding<input value={imageAlt} maxLength={500} onChange={event => setImageAlt(event.target.value)} /></label><button type="button" className="account-secondary" disabled={!imageId || !imageAlt.trim()} onClick={() => { if (!assetMap.current.has(imageId)) return; editor.chain().focus().insertContent({ type: 'image', attrs: { assetId: imageId, alt: imageAlt.trim() } }).run(); setImageOpen(false); setImageAlt(''); }}>Afbeelding invoegen</button><p>Upload nieuwe afbeeldingen via de mediabibliotheek onder de editor.</p></div>}
    <BubbleMenu editor={editor} pluginKey="blog-formatting" options={{ placement: 'top' }}><div className="blog-floating-tools" role="toolbar" aria-label="Selectie opmaken"><Formatting editor={editor} compact /></div></BubbleMenu>
    <FloatingMenu editor={editor} pluginKey="blog-blocks" options={{ placement: 'bottom-start' }}><div className="blog-floating-tools" role="toolbar" aria-label="Blok invoegen"><Tool label="Kop invoegen" onClick={() => block('heading')}>Kop</Tool><Tool label="Lijst invoegen" onClick={() => block('bullet')}>Lijst</Tool><Tool label="Tabelblok invoegen" onClick={() => block('table')}>Tabel</Tool></div></FloatingMenu>
    <EditorContent editor={editor} />
    {slash && <div className="blog-slash-menu" role="toolbar" aria-label="Snelle blokkeuze"><span>Blok invoegen</span><button type="button" onClick={() => block('paragraph')}>Alinea</button><button type="button" onClick={() => block('heading')}>Kop 2</button><button type="button" onClick={() => block('bullet')}>Opsomming</button><button type="button" onClick={() => block('table')}>Tabel</button></div>}
    {selection?.table && <div className="blog-table-tools" role="toolbar" aria-label="Tabel bewerken"><button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>Rij toevoegen</button><button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>Kolom toevoegen</button><button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>Rij verwijderen</button><button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>Kolom verwijderen</button><button type="button" onClick={() => editor.chain().focus().deleteTable().run()}>Tabel verwijderen</button></div>}
    <p className="account-legal-note">Gebruik kop 2 en lager. Typ / op een lege regel voor blokken. Sneltoetsen: Ctrl/⌘ B, I, U en Z.</p>
  </div>;
}
