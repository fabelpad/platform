import type { Metadata } from 'next';
import PrivacyAdminPage from '../../../src/PrivacyAdminPage';
export const metadata: Metadata = { title: 'Privacyverzoeken beheren — Fabelpad', robots: { index: false, follow: false } };
export default function Page() { return <PrivacyAdminPage />; }
