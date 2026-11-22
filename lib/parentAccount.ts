/** Safe parent-account state. No credentials or child names belong in this DTO. */
export type ParentAccountStatus = {
  state: 'onboarding' | 'active' | 'deletion_pending' | 'deleting';
  termsVersion: string;
  privacyVersion: string;
  acceptedTermsVersion: string | null;
  shownPrivacyVersion: string | null;
  lastActivityAt: string | null;
  deletionDeadline: string | null;
  consents: { profileId: string; grantedAt: string; withdrawnAt: string | null; method: 'guardian_declaration' }[];
};

export function parentNeedsOnboarding(status: ParentAccountStatus | undefined): boolean {
  return !status || status.state === 'onboarding' || status.state === 'active' && status.acceptedTermsVersion !== status.termsVersion;
}

export function localAccountDate(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return 'de datum in je accountoverzicht';
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Amsterdam' }).format(new Date(value)) + ' (Nederlandse tijd)';
}
