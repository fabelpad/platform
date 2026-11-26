/** Separate, optional permission; never a condition for creating an account. */
export const MARKETING_CONSENT_VERSION = '2026-11-24';
export const MARKETING_CONSENT_TEXT = 'Ja, ik ontvang graag promotionele e-mails en updates van Fabelpad. Ik kan mij altijd afmelden.';

export type ParentEmailPreferences = { marketingConsent: boolean; updatedAt: string | null };
