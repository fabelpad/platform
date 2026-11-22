import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { compileSource } from './source-test-loader.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(path.join(tmpdir(), 'fabelpad-native-export-'));
try {
  const reading = await import(await compileSource(pathToFileURL(path.join(root, 'src/storyReadingLevels.ts')), temporary));
  const { storyPlayArt } = await import(await compileSource(pathToFileURL(path.join(root, 'src/storyPlayArt.ts')), temporary));
  const { worlds } = await import(await compileSource(pathToFileURL(path.join(root, 'src/worlds.ts')), temporary));
  const stories = [];
  for (const world of worlds) {
    const readingLevels = {};
    for (const level of ['under6', '6to8', '9plus']) {
      const scenes = {}, endings = {};
      for (let step = 0; step < 5; step += 1) {
        for (let route = 0; route < 2 ** step; route += 1) {
          const picks = Array.from({ length: step }, (_, i) => (route >> (step - i - 1)) & 1);
          const scene = reading.getReadingScene(world.id, step, picks, '__FABELPAD_CHILD__', level);
          if (!scene?.title || !scene.text || scene.choices.length !== 2) throw new Error(`Incomplete scene ${world.id}/${picks.join('')}`);
          scenes[picks.join('')] = scene;
        }
      }
      for (let route = 0; route < 32; route += 1) {
        const picks = Array.from({ length: 5 }, (_, i) => (route >> (4 - i)) & 1);
        const ending = reading.getReadingEnding(world.id, picks, '__FABELPAD_CHILD__', level);
        if (!ending?.title || !ending.text || !ending.keepsake) throw new Error(`Incomplete ending ${world.id}/${picks.join('')}`);
        endings[picks.join('')] = ending;
      }
      readingLevels[level] = { scenes, endings };
    }
    const play = storyPlayArt[world.id];
    stories.push({ ...world, ...(play ? { playImage: play.image, playImageAlt: play.imageAlt } : {}), ...readingLevels['9plus'], readingLevels });
  }
  const releasesPath = path.join(root, 'mobile/src/releases');
  await mkdir(releasesPath, { recursive: true });
  const previousReleases = [];
  for (const filename of (await readdir(releasesPath)).filter(name => /^[a-f0-9]{16}\.json$/.test(name))) {
    previousReleases.push(JSON.parse(await readFile(path.join(releasesPath, filename), 'utf8')));
  }
  const currentAssetPaths = [...new Set([...stories.flatMap(story => [story.image, ...(story.playImage ? [story.playImage] : [])]), '/art/play/station-platform.webp', '/brand/logo.webp', '/brand/mascot.webp'])];
  const assetPaths = [...new Set([...currentAssetPaths, ...previousReleases.flatMap(release => Object.keys(release.assets))])];
  const checksums = {};
  for (const relative of assetPaths) {
    const target = path.join(root, 'mobile/assets', relative);
    const input = currentAssetPaths.includes(relative) ? path.join(root, 'public', relative) : target;
    const hash = createHash('sha256').update(await readFile(input)).digest('hex');
    for (const release of previousReleases) {
      if (release.assets[relative] && release.assets[relative] !== hash) throw new Error(`Een illustratie van een bestaande verhaalrelease is gewijzigd: ${relative}. Gebruik een nieuwe bestandsnaam.`);
    }
    if (currentAssetPaths.includes(relative)) {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(input, target);
      checksums[relative] = hash;
    }
  }
  const version = createHash('sha256').update(JSON.stringify({ stories, checksums })).digest('hex').slice(0, 16);
  const content = { schemaVersion: 1, contentVersion: version, parts: 5, nameToken: '__FABELPAD_CHILD__', stories, assets: checksums };
  await mkdir(path.join(root, 'mobile/src'), { recursive: true });
  const archive = async release => {
    if (!/^[a-f0-9]{16}$/.test(release.contentVersion)) throw new Error('Ongeldige contentrelease-identiteit.');
    const filename = path.join(releasesPath, `${release.contentVersion}.json`);
    const bytes = JSON.stringify(release);
    try { await writeFile(filename, bytes, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (await readFile(filename, 'utf8') !== bytes) throw new Error(`Een bestaande onveranderlijke contentrelease is gewijzigd: ${release.contentVersion}`);
    }
  };
  // Preserve the previously shipped catalog before replacing the current one.
  // Started stories pin one of these bundled releases across app updates.
  try { await archive(JSON.parse(await readFile(path.join(root, 'mobile/src/content.json'), 'utf8'))); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await archive(content);
  const releases = (await readdir(releasesPath)).filter(name => /^[a-f0-9]{16}\.json$/.test(name)).sort();
  await writeFile(path.join(root, 'mobile/src/releaseCatalog.ts'), '// Generated by scripts/export-native-content.mjs. Never remove a shipped release.\nimport type { ContentRelease } from \'./types\';\n' + releases.map((name, i) => `import release${i} from './releases/${name}';`).join('\n') + '\nexport const releaseCatalog: Record<string, ContentRelease> = {\n' + releases.map((name, i) => `  '${name.slice(0, -5)}': release${i} as ContentRelease,`).join('\n') + '\n};\n');
  await writeFile(path.join(root, 'mobile/src/content.json'), JSON.stringify(content));
  await writeFile(path.join(root, 'mobile/src/assets.ts'), '// Generated by scripts/export-native-content.mjs. Metro needs literal require paths.\nexport const assets: Record<string, number> = {\n' + assetPaths.map(p => `  ${JSON.stringify(p)}: require(${JSON.stringify('../assets' + p)}),`).join('\n') + '\n};\n');
  console.log(JSON.stringify({ stories: stories.length, chapters: stories.length * 5, scenes: stories.length * 31, endings: stories.length * 32, readingLevels: 3, readingScenes: stories.length * 31 * 3, readingEndings: stories.length * 32 * 3, assets: assetPaths.length, contentVersion: version, preservedReleases: previousReleases.length }));
} finally { await rm(temporary, { recursive: true, force: true }); }
