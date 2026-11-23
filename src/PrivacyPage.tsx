import { LEGAL_DOCUMENTS } from '../lib/legal/documents';
import LegalDocumentPage from './LegalDocumentPage';
import { privacy } from './privacyContent';
import NarrationPrivacyNotice from './NarrationPrivacyNotice';

export default function PrivacyPage({ narrationStaging = false }: { narrationStaging?: boolean } = {}) {
  return <LegalDocumentPage document={privacy} downloadUrl={LEGAL_DOCUMENTS.privacy.downloadUrl} privacy notice={narrationStaging ? <NarrationPrivacyNotice /> : undefined} />;
}
