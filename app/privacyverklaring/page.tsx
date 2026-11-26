import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { PRIVACY_VERSION } from '../../lib/legal/documents';
import PrivacyPage from '../../src/PrivacyPage';
export const metadata: Metadata = { title: 'Privacyverklaring — Fabelpad', description: 'Hoe Fabelpad met gegevens van ouders en kinderen omgaat, voor het webaccount en de afzonderlijke lokale Android-app.', alternates: { canonical: 'https://fabelpad.nl/privacyverklaring' } };
export default async function Page({ searchParams }: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const version = (await searchParams).versie;
  if (version === '2026-11-22') redirect('/legal/2026-11-22/privacyverklaring.md');
  if (version === '2026-11-22.1') redirect('/legal/2026-11-22.1/privacyverklaring.md');
  if (version === '2026-11-23') redirect('/legal/2026-11-23/privacyverklaring.md');
  if (version === '2026-11-23.1') redirect('/legal/2026-11-23.1/privacyverklaring.md');
  if (version !== undefined && version !== PRIVACY_VERSION) notFound();
  return <PrivacyPage narrationStaging={process.env.FABELPAD_DEPLOY_ENV === 'staging' || process.env.FABELPAD_DEPLOY_ENV === 'local'} />;
}
