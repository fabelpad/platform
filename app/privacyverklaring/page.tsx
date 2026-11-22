import type { Metadata } from 'next';
import PrivacyPage from '../../src/PrivacyPage';
export const metadata: Metadata = { title: 'Privacyverklaring — Fabelpad', description: 'Hoe Fabelpad met gegevens van ouders en kinderen omgaat, voor het webaccount en de afzonderlijke lokale Android-app.', alternates: { canonical: 'https://fabelpad.nl/privacyverklaring' } };
export default function Page() { return <PrivacyPage />; }
