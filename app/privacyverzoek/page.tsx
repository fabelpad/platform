import type { Metadata } from 'next';
import PrivacyRequestPage from '../../src/PrivacyRequestPage';
export const metadata: Metadata = { title: 'Privacyverzoek — Fabelpad', description: 'Doe een Fabelpad-privacyverzoek zonder ouderlogin. Ook kinderen van 12 kunnen rechtstreeks contact opnemen.' };
export default async function Page({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const params = await searchParams;
  return <PrivacyRequestPage initialDeletion={params.type === 'verwijderen'} />;
}
