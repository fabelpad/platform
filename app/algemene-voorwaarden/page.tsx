import type { Metadata } from 'next';
import { LEGAL_DOCUMENTS } from '../../lib/legal/documents';
import LegalDocumentPage from '../../src/LegalDocumentPage';
import { terms } from '../../src/legalContent';
export const metadata: Metadata = { title: 'Algemene voorwaarden — Fabelpad', description: 'Algemene voorwaarden voor Fabelpad, aangeboden door DG Webservices.' };
export default function Page() { return <LegalDocumentPage document={terms} downloadUrl={LEGAL_DOCUMENTS.terms.downloadUrl} />; }
