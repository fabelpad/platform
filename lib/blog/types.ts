/** Receiving-website blog model. JSON revisions are immutable on publication. */
export type BlogRevision = number;
export type BlogNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: BlogNode[] };
export type BlogContent = BlogNode & { type: 'doc'; content: BlogNode[] };
export type BlogRecord = { id: string; name: string; bio?: string; active?: boolean };
export type BlogHero = { assetId: string; alt: string; focalPoint: { x: number; y: number } };
export type BlogDocument = {
  type: 'blog' | 'article'; locale: 'nl-NL'; title: string; slug: string; excerpt: string;
  authorId: string; categoryId: string | null; tags: string[]; content: BlogContent;
  seo: { title: string; description: string }; hero: BlogHero | null; ogImageAssetId: string | null;
};
export type BlogAsset = { assetId: string; mimeType: string; width: number; height: number; url: string; originalName?: string; createdAt?: string };
export type BlogPublication = { revision: number; state: 'publishing' | 'published'; attempts: number; lastError: string | null; verifiedAt: string | null; nextAttemptAt?: string | null };
export type BlogEditor = {
  postId: string; revision: number; draftRevision: number | null; publishedRevision: number | null;
  document: BlogDocument; liveDocument: BlogDocument | null; state: 'draft' | 'publishing' | 'published';
  publishedAt: string | null; updatedAt: string; publicUrl: string | null; previewUrl: string;
  publication: BlogPublication | null; revisions?: { revision: number; title: string; createdAt: string; actor: string }[];
};
export type BlogArticle = {
  postId: string; revision: number; document: BlogDocument; author: BlogRecord;
  category: BlogRecord | null; assets: BlogAsset[]; publishedAt: string; updatedAt: string;
  publicUrl: string; canonicalUrl: string;
};
export type BlogListItem = { postId: string; revision: number; title: string; slug: string; excerpt: string; type: 'blog' | 'article'; locale: string; author: BlogRecord; category: BlogRecord | null; hero: (BlogHero & { asset: BlogAsset }) | null; publishedAt: string; updatedAt: string; publicUrl: string };
export type BlogCatalog = { posts: BlogListItem[]; page: number; totalPages: number; total: number; categories: BlogRecord[] };
export type BlogSite = { siteId: string; siteName: string; origin: string; canonicalOrigin: string; environment: 'staging' | 'production' | 'local'; blogPath: string; locales: string[]; contentTypes: string[] };
export type BlogAdminState = { site: BlogSite; posts: BlogEditor[]; authors: BlogRecord[]; categories: BlogRecord[]; assets: BlogAsset[]; defaultAuthorId: string };

/** The shared, authoritative SocialHero v1 public response. */
export type SocialHeroPostStatus = {
  postId: string; externalId: string; slug: string; state: 'draft' | 'publishing' | 'published';
  revision: number; draftRevision: number | null; publishedRevision: number | null;
  previewUrl: string | null; publicUrl: string | null; publishedAt: string | null;
};
export type SocialHeroCapabilities = {
  contractVersion: 1; connectionId: string; destinationId: string; credentialState: 'pending' | 'active';
  siteId: string; siteName: string; origin: string; environment: 'staging' | 'production'; blogPath: string;
  contentTypes: string[]; locales: string[]; scopes: ('read' | 'draft' | 'publish')[];
  authors: BlogRecord[]; categories: BlogRecord[]; media: { mimeTypes: string[]; maxBytes: number };
};
export type SocialHeroConnectionView = {
  status: 'disconnected' | 'pending' | 'active' | 'expired' | 'revoked'; connectionId: string | null;
  destinationId: string | null; site: BlogSite; allowDraft: boolean; allowPublish: boolean;
  scopes: string[]; connectedAt: string | null; expiresAt: string | null; lastCheckedAt: string | null;
};
