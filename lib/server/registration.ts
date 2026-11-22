import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../supabase/config';
import { TERMS_VERSION, PRIVACY_VERSION } from '../legal/documents';
import { parentRpcError } from './parent';
import { object, RequestError } from './http';

export type RegistrationChannel = 'otp' | 'google';
const lifetimeSeconds = 30 * 60;
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function cookieName() { return new URL(getSupabaseConfig()!.appUrl).protocol === 'https:' ? '__Host-fabelpad-registration' : 'fabelpad-registration'; }
function options() { return { httpOnly: true, sameSite: 'lax' as const, secure: new URL(getSupabaseConfig()!.appUrl).protocol === 'https:', path: '/' }; }

/** The browser only holds an opaque capability. Declarations live in the DB,
 * not in user_metadata or an unsigned cookie containing claimed consent. */
export async function beginParentRegistration(client: SupabaseClient, channel: RegistrationChannel, email?: string) {
  const nonce = randomBytes(32).toString('base64url');
  const { data, error } = await client.rpc('begin_parent_registration', {
    p_nonce_hash: digest(nonce), p_channel: channel, p_email_hash: channel === 'otp' && email ? digest(email) : null,
    p_terms_version: TERMS_VERSION, p_privacy_version: PRIVACY_VERSION, p_parent_declaration: true, p_accept_terms: true,
  });
  if (error) {
    if (error.message === 'registration_rate_limited') throw new RequestError(429, 'registration_rate_limited', 'Wacht even voordat je een nieuwe registratie start.');
    parentRpcError(error);
  }
  if (!object(data) || typeof data.expiresAt !== 'string' || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error('Invalid registration proof');
  return { value: `${channel}.${nonce}`, maxAge: Math.max(1, Math.min(lifetimeSeconds, Math.floor((Date.parse(data.expiresAt) - Date.now()) / 1000))) };
}
export async function storeParentRegistration(proof: { value: string; maxAge: number }) {
  (await cookies()).set(cookieName(), proof.value, { ...options(), maxAge: proof.maxAge });
}
export async function clearParentRegistration() {
  const store = await cookies();
  if (store.getAll().some(cookie => cookie.name === cookieName())) store.set(cookieName(), '', { ...options(), maxAge: 0 });
}
export async function parentRegistrationChannel(): Promise<RegistrationChannel | null> {
  const value = (await cookies()).getAll().find(cookie => cookie.name === cookieName())?.value;
  const match = /^(otp|google)\.[A-Za-z0-9_-]{43}$/u.exec(value || '');
  return match ? match[1] as RegistrationChannel : null;
}
export async function completeParentRegistration(client: SupabaseClient, channel?: RegistrationChannel): Promise<boolean> {
  const value = (await cookies()).getAll().find(cookie => cookie.name === cookieName())?.value;
  if (!value) return false;
  const match = /^(otp|google)\.([A-Za-z0-9_-]{43})$/u.exec(value);
  if (!match || channel && match[1] !== channel) { await clearParentRegistration(); return false; }
  // Google evidence is consumed only immediately after a successful PKCE
  // exchange in our callback, never by a generic existing-session retry.
  if (match[1] === 'google' && channel !== 'google') throw new RequestError(428, 'google_registration_required', 'Hervat je registratie via Google om je eerdere keuzes veilig te bewaren.');
  const { data, error } = await client.rpc('complete_parent_registration', { p_nonce_hash: digest(match[2]), p_channel: match[1] });
  if (error) parentRpcError(error);
  if (!object(data) || typeof data.completed !== 'boolean') throw new Error('Invalid registration completion');
  await clearParentRegistration();
  return data.completed;
}
