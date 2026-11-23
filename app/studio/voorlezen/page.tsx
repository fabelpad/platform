import type { Metadata } from 'next';
import StudioPageAccess from '../../../src/StudioPageAccess';
import NarrationAdminPage from '../../../src/NarrationAdminPage';
export const metadata: Metadata = { title: 'Voorlezen — Fabelpad beheer', robots: { index: false, follow: false } };
export default function Page() { return <StudioPageAccess returnTo="/studio/voorlezen"><NarrationAdminPage /></StudioPageAccess>; }
