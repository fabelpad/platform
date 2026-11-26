import type { MetadataRoute } from 'next';
import { getPublicBlogSite, publicBlogRpc } from '../lib/blog/public';
export const dynamic = 'force-dynamic';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await getPublicBlogSite();
  if (site.environment !== 'production') return [];
  const result = await publicBlogRpc('sitemap') as { posts: { slug: string; updatedAt: string }[] };
  return [{ url: `${site.canonicalOrigin}/blog` }, ...result.posts.map(post => ({ url: `${site.canonicalOrigin}/blog/${post.slug}`, lastModified: post.updatedAt }))];
}
