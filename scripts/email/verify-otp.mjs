#!/usr/bin/env node
// Standalone first-install proof: no running Fabelpad app is required.
import { execFileSync } from 'node:child_process';
import { emitKeypressEvents } from 'node:readline';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const MAILBOX = 'info@dgwebservices.nl';
const TARGETS = {
  staging: { origin: 'https://staging.fabelpad.nl', ref: 'tlwfpivafcokcjyjwgmq' },
  production: { origin: 'https://fabelpad.nl', ref: 'aptprpkosqctwrzeetgs' },
};
const NAMES = ['FABELPAD_APP_ORIGIN', 'FABELPAD_DATA_MODE', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_URL'];
export class OtpVerificationError extends Error {
  constructor(message = 'OTP-controle niet afgerond; technische details en credentials blijven verborgen.') { super(message); }
}
export function validateConfiguration(environment, payload) {
  const target = TARGETS[environment];
  if (!target || !Array.isArray(payload?.variables) || payload.variables.length !== 4) throw new OtpVerificationError('Omgeving of de vier GitHub-variabelen komen niet overeen.');
  const values = Object.fromEntries(payload.variables.map(row => [row.name, row.value]));
  if (Object.keys(values).sort().join() !== NAMES.join() || values.FABELPAD_APP_ORIGIN !== target.origin || values.FABELPAD_DATA_MODE !== 'supabase' || values.NEXT_PUBLIC_SUPABASE_URL !== `https://${target.ref}.supabase.co` || !/^sb_publishable_[A-Za-z0-9_-]{10,}$/u.test(values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '')) throw new OtpVerificationError('De publieke configuratie hoort niet bij het vaste Fabelpad-doel.');
  return { environment, ...target, url: values.NEXT_PUBLIC_SUPABASE_URL, key: values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
}
export async function verifyConfiguredHook(config, fetcher = fetch) {
  // A configured endpoint rejects this unsigned body with 401, before sending.
  // 503 means missing configuration. This is only a preflight, not delivery proof.
  let response;
  try { response = await fetcher(`${config.url}/functions/v1/auth-email`, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(5000) }); }
  catch { throw new OtpVerificationError('De eigen mailhook is niet bereikbaar.'); }
  const status = response.status;
  try { await response.body?.cancel(); } catch { /* Never log provider bodies. */ }
  if (status !== 401) throw new OtpVerificationError('De eigen mailhook is nog niet correct geconfigureerd; rond eerst de mailconfiguratiecontrole af.');
}
export function boundedSupabaseFetch(config, fetcher = fetch) {
  return async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.origin !== config.url || url.username || url.password || !/^\/(?:auth|rest)\/v1\//u.test(url.pathname)) throw new OtpVerificationError();
    const timeout = AbortSignal.timeout(15_000);
    try { return await fetcher(input, { ...options, redirect: 'error', signal: options.signal ? AbortSignal.any([timeout, options.signal]) : timeout }); }
    catch { throw new OtpVerificationError(); }
  };
}
export async function verifyAdminOtp(client, config, readCode, now = () => new Date()) {
  let sessionCreated = false, proof, failure;
  try {
    const sent = await client.auth.signInWithOtp({ email: MAILBOX, options: { shouldCreateUser: true } });
    if (sent.error) throw new OtpVerificationError('De OTP-aanvraag is geweigerd; controleer de eigen providerinstellingen.');
    const code = await readCode();
    if (typeof code !== 'string' || !/^\d{8}$/u.test(code)) throw new OtpVerificationError('Gebruik de achtcijferige code uit de beheermailbox.');
    const verified = await client.auth.verifyOtp({ email: MAILBOX, token: code, type: 'email' });
    sessionCreated = Boolean(verified.data?.session);
    if (verified.error || !sessionCreated) throw new OtpVerificationError('De code is niet bevestigd; vraag zo nodig een nieuwe aan.');
    const checked = await client.auth.getUser();
    const user = checked.data?.user;
    if (checked.error || !user || user.email?.toLowerCase() !== MAILBOX || !user.email_confirmed_at || user.is_anonymous !== false || !user.id) throw new OtpVerificationError('De server heeft de bedoelde bevestigde beheeridentiteit niet teruggegeven.');
    const role = await client.from('content_admins').select('user_id,grant_source').eq('user_id', user.id).maybeSingle();
    if (role.error || role.data?.user_id !== user.id || !['bootstrap_email', 'manual'].includes(role.data?.grant_source)) throw new OtpVerificationError('De bevestigde gebruiker heeft nog niet de bedoelde databasebeheerrol.');
    const catalog = await client.rpc('get_content_catalog');
    if (catalog.error || !Array.isArray(catalog.data) || catalog.data.length < 13) throw new OtpVerificationError('De verwachte verhaalcontent is niet leesbaar.');
    proof = { environment: config.environment, projectRef: config.ref, appOrigin: config.origin, verifiedAt: now().toISOString(), emailOtpVerified: true, adminVerified: true, catalogStories: catalog.data.length };
  } catch (error) { failure = error instanceof OtpVerificationError ? error : new OtpVerificationError(); }
  finally {
    if (sessionCreated) {
      try { const result = await client.auth.signOut({ scope: 'local' }); if (result.error) throw new Error(); }
      catch { failure = new OtpVerificationError('De testsessie kon niet worden afgemeld; controleer de eigen Auth-sessies voordat je verdergaat.'); }
    }
  }
  if (failure) throw failure;
  return { ...proof, sessionSignedOut: true };
}
function hiddenCode() {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== 'function') throw new OtpVerificationError('Gebruik een eigen interactieve terminal; geen pipe of bestand voor codes.');
  process.stdout.write('Voer de ontvangen code in (invoer blijft verborgen): ');
  emitKeypressEvents(process.stdin);
  return new Promise((accept, reject) => {
    let value = '';
    const previousRaw = process.stdin.isRaw;
    const finish = error => {
      clearTimeout(timeout); process.stdin.off('keypress', keypress); process.stdin.setRawMode(Boolean(previousRaw)); process.stdin.pause(); process.stdout.write('\n');
      if (error) reject(error); else accept(value);
    };
    const keypress = (character, key = {}) => {
      if (key.ctrl && key.name === 'c') return finish(new OtpVerificationError('Controle afgebroken.'));
      if (key.name === 'return') return finish();
      if (key.name === 'backspace') value = value.slice(0, -1);
      else if (typeof character === 'string' && /^\d$/u.test(character) && value.length < 10) value += character;
    };
    const timeout = setTimeout(() => finish(new OtpVerificationError('Invoer verlopen; vraag een nieuwe code aan.')), 300_000);
    process.stdin.on('keypress', keypress); process.stdin.setRawMode(true); process.stdin.resume();
  });
}
async function main(args) {
  if (args.length !== 3 || args[0] !== '--environment' || !TARGETS[args[1]] || args[2] !== '--provider-config-checked') throw new OtpVerificationError('Gebruik: node scripts/email/verify-otp.mjs --environment staging|production --provider-config-checked (na geslaagde mailconfiguratie --check).');
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new OtpVerificationError('Deze controle vereist een eigen interactieve terminal.');
  let payload;
  try { payload = JSON.parse(execFileSync('gh', ['api', `repos/fabelpad/platform/environments/${args[1]}/variables`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15_000 })); }
  catch { throw new OtpVerificationError('De vier GitHub-environmentvariabelen konden niet worden gelezen.'); }
  const config = validateConfiguration(args[1], payload);
  await verifyConfiguredHook(config);
  const client = createClient(config.url, config.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: boundedSupabaseFetch(config) } });
  const proof = await verifyAdminOtp(client, config, hiddenCode);
  process.stdout.write(JSON.stringify(proof, null, 2) + '\n');
  process.stdout.write('OTP en beheerrol gecontroleerd. Geen host-readinessbestand aangemaakt; combineer met de geverifieerde Auth/Resend-configuratie en controleer de appflow na kandidaatbouw.\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await main(process.argv.slice(2)); } catch (error) { process.stderr.write((error instanceof OtpVerificationError ? error.message : 'Controle mislukt; details blijven verborgen.') + '\n'); process.exitCode = 1; }
}
