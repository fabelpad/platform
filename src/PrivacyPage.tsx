import { LEGAL_DOCUMENTS } from '../lib/legal/documents';
import LegalDocumentPage from './LegalDocumentPage';
import { privacy } from './privacyContent';

export default function PrivacyPage() {
  return <LegalDocumentPage document={privacy} downloadUrl={LEGAL_DOCUMENTS.privacy.downloadUrl} privacy />;
}
