import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some(arg => !arg.startsWith('--target='))) {
  console.error('Gebruik: node scripts/config-check.mjs [--target=local|staging|production]');
  process.exit(64);
}
for (const name of ['.env.local', '.env']) {
  const file = path.join(root, name);
  if (existsSync(file)) process.loadEnvFile(file);
}
const target = args.find(arg => arg.startsWith('--target='))?.split('=')[1]
  ?? process.env.FABELPAD_DEPLOY_ENV ?? 'local';
const errors = [];
const requireName = name => {
  if (!process.env[name]?.trim()) errors.push(`${name}: ontbreekt`);
};
if (!['local', 'staging', 'production'].includes(target)) errors.push('FABELPAD_DEPLOY_ENV: ongeldige omgeving');
const publicNames = new Set(['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']);
for (const name of Object.keys(process.env)) {
  if (name.startsWith('NEXT_PUBLIC_') && !publicNames.has(name)) errors.push(`${name}: staat niet op de publieke allowlist`);
  if (name.startsWith('EXPO_PUBLIC_') && /(SECRET|SERVICE_ROLE|PASSWORD|PRIVATE|SIGNING|KEYSTORE)/i.test(name)) {
    errors.push(`${name}: serversecret mag niet publiek zijn`);
  }
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
if (!!url !== !!key) errors.push('NEXT_PUBLIC_SUPABASE_URL en NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: configureer beide of geen van beide');
if (url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw new Error();
  } catch { errors.push('NEXT_PUBLIC_SUPABASE_URL: verwacht een HTTPS-origin zonder credentials'); }
}
if (key) {
  if (!key.startsWith('sb_publishable_') || key.length <= 20) errors.push('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: verwacht sb_publishable_; serverkeys en oude JWT-keys zijn verboden');
}
const appUrl = process.env.APP_URL?.trim();
if (appUrl) {
  try {
    const parsed = new URL(appUrl);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
    if (!(parsed.protocol === 'https:' || (target === 'local' && loopback && parsed.protocol === 'http:'))
      || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) throw new Error();
  } catch { errors.push('APP_URL: verwacht een canonieke HTTPS-origin (HTTP-loopback mag lokaal)'); }
}
for (const name of ['FABELPAD_AUTH_EMAIL_ENABLED', 'FABELPAD_AUTH_GOOGLE_ENABLED']) {
  if (process.env[name] !== undefined && !['true', 'false'].includes(process.env[name])) errors.push(`${name}: verwacht true of false`);
  if (process.env[name] === 'true' && (!url || !key || !appUrl)) errors.push(`${name}: vereist Supabase-configuratie en APP_URL`);
}
const sha = process.env.FABELPAD_RELEASE_SHA?.trim();
if (sha && !/^[0-9a-f]{40}$/.test(sha)) errors.push('FABELPAD_RELEASE_SHA: verwacht een volledige SHA van 40 kleine hextekens');
if (target !== 'local') {
  for (const name of ['APP_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'FABELPAD_RELEASE_SHA']) requireName(name);
}
if (errors.length) {
  console.error(`Configuratie afgewezen (${target}); alleen namen en redenen worden getoond:\n${errors.map(error => `- ${error}`).join('\n')}`);
  process.exit(78);
}
console.log(`Configuratie geldig voor ${target}: ${url ? 'Supabase-namen aanwezig; externe werking niet getest' : 'lokale demo zonder Supabase'}. Geen secretwaarden getoond.`);
