import type { Metadata } from 'next';
import EmailSettingsPage from '../../../src/EmailSettingsPage';
import '../../../src/email-settings.css';

export const metadata: Metadata = { title: 'E-mailinstellingen — Fabelpad beheer', robots: { index: false, follow: false } };
export default function Page() { return <EmailSettingsPage />; }
