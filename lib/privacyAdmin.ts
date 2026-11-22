/** Minimal support case metadata. Never put mailbox text, email or child names here. */
export const PRIVACY_REQUEST_KINDS = {
  access: 'Inzage', export: 'Gegevens overdragen of kopie', correction: 'Correctie', objection: 'Bezwaar',
  restriction: 'Beperking', consent_withdrawal: 'Toestemming intrekken', erasure: 'Gegevens wissen',
} as const;
export const PRIVACY_EXTENSION_REASONS = {
  complex_request: 'Het verzoek is complex en vereist aanvullend onderzoek.',
  multiple_requests: 'Er zijn meerdere samenhangende verzoeken die zorgvuldig moeten worden behandeld.',
} as const;
export type PrivacyRequestKind = keyof typeof PRIVACY_REQUEST_KINDS;
export type PrivacyCase = {
  id: string; reference: string; receivedAt: string; responseDueAt: string;
  kind: PrivacyRequestKind; scope: 'parent' | 'child'; parentId: string | null; profileId: string | null;
  verification: 'pending' | 'verified' | 'declined'; state: 'received' | 'verified' | 'executing' | 'completed' | 'declined' | 'extended';
  verificationMethod: 'verified_parent' | 'proportionate_support' | null; firstResponseAt: string | null;
  completedAt: string | null; extendedDueAt: string | null; extensionReason: string | null;
};
export type PrivacyCasesResponse = { cases: PrivacyCase[]; total: number; truncated: boolean; nextOffset: number | null };
