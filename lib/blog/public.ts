import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../supabase/config';
import { blogSite, verifyBlogIdentity } from './config';
import { validateBlogDocument, isBlogUuid } from './document';
import type { BlogArticle, BlogAsset, BlogCatalog, BlogSite } from './types';

export type BlogPublicPost = { article: BlogArticle | null; redirect: string | null; verification: { publicationId: string; revision: number; proof: string } | null };
export async function publicBlogRpc(action: string, input: Record<string, unknown> = {}): Promise<unknown> {
  const config = getSupabaseConfig();
  if (!config) {
    if (action === 'site') return blogSite('local');
    if (action === 'catalog') return { posts: [], page: 1, totalPages: 1, total: 0, categories: [] };
    if (action === 'post') return { article: null, redirect: null, verification: null };
    if (action === 'sitemap') return { posts: [] };
    throw new Error('Blog is unavailable');
  }
  const client = createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store', signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000) }) },
  });
  const { data, error } = await client.rpc('blog_public', { p_action: action, p_input: input });
  if (error) throw new Error('Blog is temporarily unavailable');
  return data;
}
export const getPublicBlogSite = cache(async (): Promise<BlogSite> => {
  const site = await publicBlogRpc('site') as BlogSite;
  const config = getSupabaseConfig();
  if (config) verifyBlogIdentity(site, new URL(config.url).hostname.split('.')[0]);
  return site;
});
function assetsForPublic(assets: BlogAsset[], origin: string): BlogAsset[] {
  if (!Array.isArray(assets) || assets.some(asset => !isBlogUuid(asset.assetId) || !['image/png', 'image/jpeg'].includes(asset.mimeType) || !Number.isInteger(asset.width) || !Number.isInteger(asset.height))) throw new Error('Invalid public media');
  return assets.map(asset => ({ assetId: asset.assetId, mimeType: asset.mimeType, width: asset.width, height: asset.height, url: `${origin}/api/blog/media/${asset.assetId}` }));
}
export const getPublicBlogCatalog = cache(async (page = 1, categoryId?: string): Promise<BlogCatalog> => {
  const [site, catalog] = await Promise.all([getPublicBlogSite(), publicBlogRpc('catalog', { page, pageSize: 12, ...(categoryId ? { categoryId } : {}) }) as Promise<BlogCatalog>]);
  if (!catalog || !Array.isArray(catalog.posts) || !Number.isSafeInteger(catalog.total) || !Array.isArray(catalog.categories)) throw new Error('Invalid blog catalog');
  return { ...catalog, posts: catalog.posts.map(post => ({ ...post, publicUrl: `${site.origin}/blog/${encodeURIComponent(post.slug)}`, hero: post.hero ? { ...post.hero, asset: assetsForPublic([post.hero.asset], site.origin)[0] } : null })) };
});
export const getPublicBlogPost = cache(async (slug: string): Promise<BlogPublicPost> => {
  const [site, result] = await Promise.all([getPublicBlogSite(), publicBlogRpc('post', { slug }) as Promise<BlogPublicPost>]);
  if (!result || typeof result !== 'object') throw new Error('Invalid blog article');
  if (result.redirect !== null && (typeof result.redirect !== 'string' || !/^\/blog\/[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(result.redirect))) throw new Error('Invalid article redirect');
  if (!result.article) return result;
  const article = result.article;
  if (!isBlogUuid(article.postId) || !Number.isSafeInteger(article.revision) || !article.author?.name || !Number.isFinite(Date.parse(article.publishedAt)) || !Number.isFinite(Date.parse(article.updatedAt))) throw new Error('Invalid blog article');
  const document = validateBlogDocument(article.document);
  return { ...result, article: { ...article, document, assets: assetsForPublic(article.assets, site.origin), publicUrl: `${site.origin}/blog/${document.slug}`, canonicalUrl: `${site.canonicalOrigin}/blog/${document.slug}` } };
});

