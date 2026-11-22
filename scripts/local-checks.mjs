import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const checks = [
  'profile-storage-check.mjs', 'cloud-sync-check.mjs', 'parent-activity-check.mjs',
  'story-memory-check.mjs', 'catalog-storage-check.mjs', 'story-catalog-check.mjs',
  'story-growth-check.mjs', 'story-reading-levels-check.mjs', 'story-play-check.mjs', 'modal-scroll-check.mjs',
  'sw-cache-check.mjs', 'prototype-platform-check.mjs', 'content-version-check.mjs',
];
for (const check of checks) {
  console.log(`\n[check] ${check}`);
  const result = spawnSync(process.execPath, ['--experimental-strip-types', `scripts/${check}`], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Re-export and compare the contract so web/native never silently use different
// story text or branch content. A difference must be deliberately regenerated.
const archives = readdirSync(new URL('../mobile/src/releases/', import.meta.url)).filter(name => name.endsWith('.json')).sort();
const generated = ['mobile/src/content.json', 'mobile/src/assets.ts', 'mobile/src/releaseCatalog.ts', ...archives.map(name => `mobile/src/releases/${name}`)];
const before = generated.map(name => readFileSync(new URL(`../${name}`, import.meta.url)));
const exported = spawnSync(process.execPath, ['scripts/export-native-content.mjs'], { cwd: root, stdio: 'inherit' });
if (exported.error) throw exported.error;
if (exported.status !== 0) process.exit(exported.status ?? 1);
if (JSON.stringify(archives) !== JSON.stringify(readdirSync(new URL('../mobile/src/releases/', import.meta.url)).filter(name => name.endsWith('.json')).sort())) {
  throw new Error('De native releasecatalogus is niet volledig gecommit. Controleer en commit de nieuwe releasearchieven.');
}
generated.forEach((name, index) => {
  if (!before[index].equals(readFileSync(new URL(`../${name}`, import.meta.url)))) {
    throw new Error(`${name} verschilt van de repositoryverhalen. Controleer en commit de opnieuw gegenereerde export.`);
  }
});
console.log('Alle lokale domeinchecks en de web/native-contentvergelijking geslaagd. Externe Supabase-/Android-werking is hiermee niet getest.');
