import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import StudioPageAccess from '../../../../src/StudioPageAccess';
import BlogAdminPage from '../../../../src/blog/BlogAdminPage';
import { isBlogUuid } from '../../../../lib/blog/document';
export const metadata: Metadata = { title: 'Artikel bewerken — Fabelpad beheer', robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params; if (!isBlogUuid(postId)) notFound();
  return <StudioPageAccess returnTo={`/studio/blog/${postId}`}><BlogAdminPage postId={postId} /></StudioPageAccess>;
}
