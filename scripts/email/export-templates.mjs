import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileSource } from '../source-test-loader.mjs';

const verify = process.argv.includes('--check');
if (process.argv.slice(2).some(argument => argument !== '--check')) throw new Error('Use export-templates.mjs [--check].');
const temporary = await mkdtemp(join(tmpdir(), 'fabelpad-email-export-'));
const root = new URL('../../', import.meta.url);
try {
  const { AUTH_EMAIL_CATALOG, EMAIL_TEMPLATE_VERSION, renderSupabaseDashboardTemplate, renderAuthEmail, renderServiceEmail } = await import(await compileSource(new URL('lib/email/templates.ts', root), temporary));
  const manifest = { templateVersion: EMAIL_TEMPLATE_VERSION, generatedBy: 'node scripts/email/export-templates.mjs', environments: {} };
  const files = new Map();
  for (const environment of ['staging', 'production']) {
    manifest.environments[environment] = Object.fromEntries(Object.entries(AUTH_EMAIL_CATALOG).map(([action, definition]) => {
      const message = renderSupabaseDashboardTemplate(action, environment);
      const relative = `${environment}/${action}.html`;
      files.set(relative, `${message.html}\n`);
      return [action, { screen: definition.dashboard, subject: message.subject, subjectKey: `mailer_subjects_${definition.key}`, contentKey: `mailer_templates_${definition.key}_content`, file: relative }];
    }));
    const context = { siteUrl: 'https://fabelpad.example.test', environment };
    files.set(`previews/${environment}-otp.html`, `${renderAuthEmail('magiclink', { token: '000000' }, context).html}\n`);
    files.set(`previews/${environment}-service.html`, `${renderServiceEmail({ kind: 'service-notice', subject: 'Een bericht over je Fabelpad-account', title: 'Een nieuw hoofdstuk', paragraphs: ['Dit is een vormgevingsvoorbeeld met synthetische gegevens. Deze pagina verstuurt geen e-mail.', 'Alle serviceberichten gebruiken dezelfde Fabelpad-opmaak.'], action: { label: 'Open Fabelpad', path: '/gezin' } }, context).html}\n`);
  }
  files.set('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
  for (const [relative, content] of files) {
    const url = new URL(`supabase/email-templates/${relative}`, root);
    if (verify) {
      let actual = '';
      try { actual = await readFile(url, 'utf8'); } catch { /* Report only the path, never message content. */ }
      if (actual !== content) throw new Error(`Email export is outdated: ${relative}. Run node scripts/email/export-templates.mjs.`);
    } else {
      await mkdir(new URL('./', url), { recursive: true });
      await writeFile(url, content, { mode: 0o644 });
    }
  }
  console.log(`${files.size} email template files ${verify ? 'verified' : 'exported'}; no email sent.`);
} finally { await rm(temporary, { recursive: true, force: true }); }
