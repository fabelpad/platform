import type { BillingEnvironment, BillingSettings, BillingGate } from './types.ts';
export const BILLING_GATES: readonly BillingGate[] = ['paymentRequired', 'foundersEnabled', 'mollieEnabled', 'playEnabled'];
export function defaultBillingSettings(environment: BillingEnvironment = 'staging'): BillingSettings {
  return { schemaVersion: 1, environment, appOrigin: environment === 'production' ? 'https://fabelpad.nl' : 'https://staging.fabelpad.nl',
    offerVersion: '2026-11-23.1', termsVersion: '2026-11-23.1', privacyVersion: '2026-11-23.1',
    prices: { month: { amountCents: 499, currency: 'EUR', enabled: true }, year: { amountCents: 3999, currency: 'EUR', enabled: true } },
    founders: { maximum: 50, durationMonths: 12, startsAt: null, endsAt: null, campaignVersion: 'founders-1' },
    mollie: { mode: 'test', expectedProfileId: '', firstMethods: ['ideal'], description: 'Fabelpad Gezin' },
    play: { packageName: 'nl.fabelpad.app', monthlyProductId: '', monthlyBasePlanId: '', yearlyProductId: '', yearlyBasePlanId: '', rtdnAudience: '', rtdnServiceAccount: '', pubsubSubscription: '' } };
}
export const DEFAULT_BILLING_SETTINGS = defaultBillingSettings();
const invalid = (): never => { throw new Error('Ongeldige betaalinstellingen.'); };
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const keys = (x: unknown, expected: string[]): x is Record<string, unknown> => object(x) && Object.keys(x).length === expected.length && expected.every(k => Object.hasOwn(x, k));
const text = (x: unknown, maximum = 200, empty = true): string => typeof x === 'string' && x.length <= maximum && (empty || x.length > 0) && x === x.trim() && !/[\u0000-\u001f\u007f<>]/u.test(x) ? x : invalid();
const integer = (x: unknown, min: number, max: number): number => Number.isSafeInteger(x) && (x as number) >= min && (x as number) <= max ? x as number : invalid();
const timestamp = (x: unknown): string | null => x === null ? null : typeof x === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(x) && Number.isFinite(Date.parse(x)) ? x : invalid();
/** Explicit allowlist prevents secret/client metadata from becoming configuration. */
export function parseBillingSettings(value: unknown): BillingSettings {
  if (!keys(value, ['schemaVersion','environment','appOrigin','offerVersion','termsVersion','privacyVersion','prices','founders','mollie','play']) || value.schemaVersion !== 1 || !['staging','production'].includes(String(value.environment))) return invalid();
  const environment = value.environment as BillingEnvironment;
  const expectedOrigin = environment === 'production' ? 'https://fabelpad.nl' : 'https://staging.fabelpad.nl';
  if (value.appOrigin !== expectedOrigin || !keys(value.prices, ['month','year']) || !keys(value.founders,['maximum','durationMonths','startsAt','endsAt','campaignVersion']) || !keys(value.mollie,['mode','expectedProfileId','firstMethods','description']) || !keys(value.play,['packageName','monthlyProductId','monthlyBasePlanId','yearlyProductId','yearlyBasePlanId','rtdnAudience','rtdnServiceAccount','pubsubSubscription'])) return invalid();
  for (const p of Object.values(value.prices)) if (!keys(p,['amountCents','currency','enabled']) || p.currency !== 'EUR' || typeof p.enabled !== 'boolean' || !Number.isSafeInteger(p.amountCents) || (p.amountCents as number) < 1 || (p.amountCents as number) > 1000000) return invalid();
  const startsAt=timestamp(value.founders.startsAt), endsAt=timestamp(value.founders.endsAt);
  if (startsAt && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) return invalid();
  if (!['test','live'].includes(String(value.mollie.mode)) || (environment === 'staging' && value.mollie.mode !== 'test') || !Array.isArray(value.mollie.firstMethods) || value.mollie.firstMethods.length > 10 || value.mollie.firstMethods.some(x => typeof x !== 'string' || !/^[a-z][a-z0-9_]{1,39}$/.test(x)) || new Set(value.mollie.firstMethods).size !== value.mollie.firstMethods.length || value.play.packageName !== 'nl.fabelpad.app') return invalid();
  const result=structuredClone(value) as unknown as BillingSettings;
  result.offerVersion=text(value.offerVersion,80,false); result.termsVersion=text(value.termsVersion,80,false); result.privacyVersion=text(value.privacyVersion,80,false);
  result.founders={maximum:integer(value.founders.maximum,1,100000),durationMonths:integer(value.founders.durationMonths,1,120),startsAt,endsAt,campaignVersion:text(value.founders.campaignVersion,80,false)};
  result.mollie.expectedProfileId=text(value.mollie.expectedProfileId,100); result.mollie.description=text(value.mollie.description,255,false);
  for (const k of ['monthlyProductId','monthlyBasePlanId','yearlyProductId','yearlyBasePlanId','rtdnAudience','rtdnServiceAccount','pubsubSubscription'] as const) result.play[k]=text(value.play[k],500);
  return result;
}
