import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import BlogArticleView from '../../../src/blog/BlogArticleView';
import { getPublicBlogPost } from '../../../lib/blog/public';
import { blogArticleMetadata, blogStructuredData, serializeBlogJsonLd } from '../../../lib/blog/seo';
export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { article } = await getPublicBlogPost((await params).slug);
  if (!article) return { title: 'Artikel niet gevonden — Fabelpad', robots: { index: false, follow: false } };
  return blogArticleMetadata(article, process.env.FABELPAD_DEPLOY_ENV === 'production');
}
export default async function Page({ params }: Props) {
  const slug = (await params).slug;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) || slug.length > 120) notFound();
  const result = await getPublicBlogPost(slug);
  if (result.redirect) permanentRedirect(result.redirect);
  if (!result.article) notFound();
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeBlogJsonLd(blogStructuredData(result.article)) }} /><BlogArticleView article={result.article} proof={result.verification?.proof} /></>;
}
