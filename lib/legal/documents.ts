import { LEGAL_DOCUMENT_HASHES } from './documentHashes';
/** Version identifiers are checked on the server before an account gains family access. */
export const TERMS_VERSION = '2026-11-22';
export const PRIVACY_VERSION = '2026-11-23';
export const LEGAL_DOCUMENTS = {
  terms: { version: TERMS_VERSION, sha256: LEGAL_DOCUMENT_HASHES.terms, title: 'Algemene voorwaarden Fabelpad', url: '/algemene-voorwaarden', downloadUrl: '/legal/2026-11-22/algemene-voorwaarden.md' },
  privacy: { version: PRIVACY_VERSION, sha256: LEGAL_DOCUMENT_HASHES.privacy, title: 'Privacyverklaring Fabelpad', url: '/privacyverklaring', downloadUrl: '/legal/2026-11-23/privacyverklaring.md' },
} as const;
