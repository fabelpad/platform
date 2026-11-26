import type { Metadata } from 'next';
import type { BlogArticle } from './types.ts';

export function blogArticleMetadata(article: BlogArticle, production: boolean): Metadata {
  const { document } = article;
  const image = article.assets.find(asset => asset.assetId === (document.ogImageAssetId || document.hero?.assetId));
  const title = document.seo.title || document.title, description = document.seo.description || document.excerpt;
  const alt = document.hero?.alt || document.title;
  return { title: `${title} — Fabelpad`, description, alternates: { canonical: article.canonicalUrl }, robots: { index: production, follow: production }, openGraph: { type: 'article', title, description, url: article.canonicalUrl, siteName: 'Fabelpad', locale: 'nl_NL', publishedTime: article.publishedAt, modifiedTime: article.updatedAt, authors: [article.author.name], tags: document.tags, ...(image ? { images: [{ url: image.url, width: image.width, height: image.height, alt }] } : {}) }, twitter: { card: image ? 'summary_large_image' : 'summary', title, description, ...(image ? { images: [{ url: image.url, alt }] } : {}) } };
}

export function blogStructuredData(article: BlogArticle) {
  const { document, author, category } = article;
  const image = article.assets.find(asset => asset.assetId === (document.ogImageAssetId || document.hero?.assetId));
  return { '@context': 'https://schema.org', '@type': document.type === 'article' ? 'Article' : 'BlogPosting', headline: document.title, description: document.seo.description || document.excerpt, inLanguage: document.locale, url: article.canonicalUrl, mainEntityOfPage: article.canonicalUrl, datePublished: article.publishedAt, dateModified: article.updatedAt, author: { '@type': author.name === 'Fabelpad' ? 'Organization' : 'Person', name: author.name }, publisher: { '@type': 'Organization', name: 'Fabelpad', url: 'https://fabelpad.nl', logo: { '@type': 'ImageObject', url: 'https://fabelpad.nl/brand/logo.webp' } }, ...(category ? { articleSection: category.name } : {}), ...(document.tags.length ? { keywords: document.tags.join(', ') } : {}), ...(image ? { image: [{ '@type': 'ImageObject', url: image.url, width: image.width, height: image.height }] } : {}) };
}
export function serializeBlogJsonLd(value: unknown): string { return JSON.stringify(value).replace(/</gu, '\\u003c').replace(/\u2028/gu, '\\u2028').replace(/\u2029/gu, '\\u2029'); }
