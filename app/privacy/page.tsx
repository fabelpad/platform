import type { Metadata } from 'next';
import PrivacyPage from '../../src/PrivacyPage';
export const metadata: Metadata = { title: 'Privacyverklaring — Fabelpad', description: 'Privacy, lokale appgegevens en gegevens verwijderen bij Fabelpad.', alternates: { canonical: 'https://fabelpad.nl/privacyverklaring' } };
export default function Page() { return <PrivacyPage />; }
