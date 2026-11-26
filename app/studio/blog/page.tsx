import type { Metadata } from 'next';
import StudioPageAccess from '../../../src/StudioPageAccess';
import BlogAdminPage from '../../../src/blog/BlogAdminPage';
export const metadata: Metadata = { title: 'Blog & artikelen — Fabelpad beheer', robots: { index: false, follow: false } };
export default function Page() { return <StudioPageAccess returnTo="/studio/blog"><BlogAdminPage /></StudioPageAccess>; }
