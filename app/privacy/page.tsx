import type { Metadata } from 'next';
import PrivacyPage from '../../src/PrivacyPage';
export const metadata: Metadata = { title: 'Privacy en gegevens verwijderen — Fabelpad', description: 'Privacyverklaring voor de lokale Fabelpad Android-app en hulp bij het verwijderen van gegevens.', alternates: { canonical: 'https://fabelpad.nl/privacy' } };
export default function Page() { return <PrivacyPage />; }
