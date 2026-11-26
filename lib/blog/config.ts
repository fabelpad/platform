import type { BlogSite } from './types.ts';

export const BLOG_SITE_ID = 'fabelpad';
export const BLOG_PATH = '/blog';
export const BLOG_ENVIRONMENTS = {
  staging: { projectRef: 'tlwfpivafcokcjyjwgmq', origin: 'https://staging.fabelpad.nl', socialHeroOrigin: 'https://socialhero-staging.dgwebservices.nl' },
  production: { projectRef: 'aptprpkosqctwrzeetgs', origin: 'https://fabelpad.nl', socialHeroOrigin: 'https://socialhero.dgwebservices.nl' },
} as const;
export function blogSite(environment: 'local' | 'staging' | 'production'): BlogSite {
  return { siteId: BLOG_SITE_ID, siteName: 'Fabelpad', origin: environment === 'local' ? 'http://127.0.0.1:3017' : BLOG_ENVIRONMENTS[environment].origin, canonicalOrigin: 'https://fabelpad.nl', environment, blogPath: BLOG_PATH, locales: ['nl-NL'], contentTypes: ['blog', 'article'] };
}
export function verifyBlogIdentity(site: BlogSite, projectRef: string): void {
  if (!['staging', 'production'].includes(site.environment)) throw new Error('Blog installation is not configured');
  const expected = BLOG_ENVIRONMENTS[site.environment as 'staging' | 'production'];
  if (site.siteId !== BLOG_SITE_ID || site.origin !== expected.origin || site.canonicalOrigin !== 'https://fabelpad.nl' || projectRef !== expected.projectRef || site.blogPath !== BLOG_PATH) throw new Error('Blog installation identity mismatch');
}
