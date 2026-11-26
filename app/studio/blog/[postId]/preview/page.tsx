import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { createSupabasePageClient } from '../../../../../lib/supabase/server';
import { getStudioPageAccess } from '../../../../../lib/server/studioAccess';
import { getSupabaseConfig } from '../../../../../lib/supabase/config';
import { isBlogUuid, validateBlogDocument } from '../../../../../lib/blog/document';
import type { BlogArticle } from '../../../../../lib/blog/types';
import BlogArticleView from '../../../../../src/blog/BlogArticleView';
import StudioPageAccess from '../../../../../src/StudioPageAccess';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Afgeschermd artikelvoorbeeld — Fabelpad beheer', robots: { index: false, follow: false, noarchive: true } };
export default async function Page({ params, searchParams }: { params: Promise<{ postId: string }>; searchParams: Promise<{ revision?: string }> }) {
  await connection();
  const { postId } = await params, { revision } = await searchParams;
  if (!isBlogUuid(postId) || revision !== undefined && (!/^[1-9][0-9]{0,15}$/u.test(revision) || !Number.isSafeInteger(Number(revision)))) notFound();
  // Gate before fetching any draft bytes. The read RPC independently checks the
  // same verified actor, session, lifecycle and trusted admin grant again.
  if (!(await getStudioPageAccess()).allowed) return <StudioPageAccess returnTo={`/studio/blog/${postId}/preview`}><span /></StudioPageAccess>;
  if (!getSupabaseConfig()) return <p>Het artikelvoorbeeld is beschikbaar zodra de blogomgeving is ingericht.</p>;
  const client = await createSupabasePageClient();
  const { data, error } = await client.rpc('blog_admin', { p_action: 'preview', p_input: { postId, ...(revision ? { revision: Number(revision) } : {}) } });
  if (error || !data) notFound();
  const article = data as BlogArticle;
  article.document = validateBlogDocument(article.document);
  article.assets = article.assets.map(asset => ({ ...asset, url: `/api/admin/blog/media/${asset.assetId}` }));
  return <BlogArticleView article={article} preview />;
}
