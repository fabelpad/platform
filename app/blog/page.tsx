import type { Metadata } from 'next';
import BlogIndexView from '../../src/blog/BlogIndexView';
import { getPublicBlogCatalog } from '../../lib/blog/public';
import { isBlogUuid } from '../../lib/blog/document';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Blog & artikelen — Fabelpad', description: 'Inspiratie, ideeën en een kijkje achter de verhalen van Fabelpad.', alternates: { canonical: 'https://fabelpad.nl/blog' }, robots: process.env.FABELPAD_DEPLOY_ENV === 'production' ? { index: true, follow: true } : { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const search = await searchParams;
  const page = typeof search.pagina === 'string' && /^[1-9][0-9]{0,5}$/u.test(search.pagina) && Number(search.pagina) <= 100000 ? Number(search.pagina) : 1;
  const category = isBlogUuid(search.categorie) ? search.categorie : undefined;
  return <BlogIndexView catalog={await getPublicBlogCatalog(page, category)} categoryId={category} />;
}
