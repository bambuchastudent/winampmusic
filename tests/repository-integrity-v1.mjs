import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (value) => value.replace(/^\.\//, '').split(/[?#]/, 1)[0];
const full = (value) => path.join(ROOT, rel(value));
const exists = (value) => fs.existsSync(full(value));
const read = (value) => fs.readFileSync(full(value), 'utf8');

const html = read('index.html');
const sw = read('sw.js');
const fastActions = read('fast-actions-v143.js');
const guard = read('import-playback-guard-v159.js');
const visualizer = read('header-visualizer-v159.js');

// 1. Every local startup script referenced by index.html must exist.
const startupScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]
  .map((match) => match[1])
  .filter((src) => src.startsWith('./'))
  .map(rel);
assert.ok(startupScripts.length > 0, 'index.html must expose local startup scripts');
for (const script of startupScripts) assert.ok(exists(script), `Missing index script: ${script}`);

// 2. Recursively follow quoted local .js targets from the current runtime graph.
// This catches script.src strings, lazy module strings, and service-worker registration targets.
const queue = [...new Set([...startupScripts, 'sw.js'])];
const visited = new Set();
while (queue.length) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);
  assert.ok(exists(file), `Missing runtime graph file: ${file}`);
  const source = read(file);
  for (const match of source.matchAll(/["'`]((?:\.\/)[^"'`?#]+\.js)(?:\?[^"'`]*)?["'`]/g)) {
    const target = rel(match[1]);
    assert.ok(exists(target), `Missing lazy/runtime JS target ${target} referenced by ${file}`);
    if (!visited.has(target)) queue.push(target);
  }
}

// 3. Every concrete local file referenced by the current service worker must exist.
for (const match of sw.matchAll(/["'](\.\/[^"']+)["']/g)) {
  const target = rel(match[1]);
  if (!target || !/\.[a-z0-9]+$/i.test(target)) continue;
  assert.ok(exists(target), `Missing service-worker target: ${target}`);
}

// 4. Manifest assets must exist.
const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons || []) {
  if (typeof icon?.src === 'string' && icon.src.startsWith('./')) {
    assert.ok(exists(icon.src), `Missing manifest icon: ${icon.src}`);
  }
}

// 5. Current production scripts and optional Share/PWA modules are protected explicitly.
const requiredScripts = [
  'fast-player-v141.js',
  'clean-playback-v150.js',
  'apple-catalog-first-v150.js',
  'apple-musickit-v150.js',
  'unified-entry-v152.js',
  'import-playback-guard-v159.js',
  'header-visualizer-v159.js',
  'fast-actions-v143.js',
  'fast-import-v150.js',
  'apple-music-import-v064.js',
  'apple-playlist-import-v150.js',
  'apple-album-import-v150.js',
  'fast-background-v150.js',
  'origin-playback-v151.js',
  'v059.js',
  'compact-share.js',
  'qr-share-v1.js',
];
for (const file of requiredScripts) assert.ok(exists(file), `Missing protected current script: ${file}`);

// 6. Now Playing/import preservation and Apple route guards stay wired.
assert.match(guard, /isPlaybackActive/);
assert.match(guard, /play:\s*preserveCurrentPlayback\s*\?\s*false\s*:\s*requestedPlay/);
assert.match(guard, /handleUrl/);
assert.match(guard, /importAlbumUrl/);
assert.match(guard, /importPlaylistUrl/);
assert.match(html, /import-playback-guard-v159\.js\?v=159/);

// 7. Header branding remains the current Ámpula MP contract.
assert.match(html, /class="brand-bottle-link"[^>]+href="https:\/\/github\.com\/bambuchastudent\/winampmusic"/);
assert.match(html, /<h1>Ámpula MP<\/h1>/);
assert.doesNotMatch(html, /class="brand-github"/);
assert.match(html, /class="app-version-link"[^>]+href="https:\/\/github\.com\/bambuchastudent\/winampmusic"[^>]*>1\.5<\/a>/);
assert.match(html, /id="headerSpectrum"/);
assert.match(visualizer, /MutationObserver/);
assert.match(visualizer, /dataset\.playing/);

// 8. Share/QR stays lazy and the shared-link receiver remains present.
assert.match(fastActions, /loadScript\('\.\/qr-share-v1\.js\?v=158'/);
assert.match(fastActions, /loadScript\('\.\/compact-share\.js\?v=158'/);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*compact-share\.js/);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*qr-share-v1\.js/);
const compactShare = read('compact-share.js');
assert.match(compactShare, /searchParams\.get\('s'\)/);
assert.match(compactShare, /searchParams\.get\('p'\)/);
assert.match(compactShare, /window\.importTracks/);

// 9. Compatibility storage identifiers remain represented by current runtime.
const compatibilitySource = [read('fast-player-v141.js'), fastActions, read('fast-background-v150.js'), read('origin-playback-v151.js')].join('\n');
for (const key of [
  'winampmusic.library.v1',
  'winampmusic.fast.current.v1',
  'winampmusic.player.v1',
  'winampmusic.background.v1',
]) {
  assert.ok(compatibilitySource.includes(key), `Missing compatibility storage key: ${key}`);
}

// 10. GitHub Pages still has its generated Apple Music config input and deploy artifact contract.
const pagesWorkflow = read('.github/workflows/pages.yml');
assert.match(pagesWorkflow, /scripts\/generate-apple-music-config\.mjs apple-music-config\.js/);
assert.match(pagesWorkflow, /path:\s*\./);
assert.ok(exists('scripts/generate-apple-music-config.mjs'));

// 11. Proven-dead removals must leave no executable/config references.
const removedFiles = ['fast-import-v142.js'];
for (const removed of removedFiles) assert.ok(!exists(removed), `Removed file still exists: ${removed}`);

const scanExtensions = new Set(['.js', '.mjs', '.html', '.css', '.json', '.webmanifest', '.yml', '.yaml']);
const ignoredReferenceRoots = [
  path.join(ROOT, 'openspec', 'changes', 'repository-cleanup-v1'),
];
const ignoredReferenceFiles = new Set([path.resolve(fileURLToPath(import.meta.url))]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const absolute = path.join(dir, entry.name);
    if (ignoredReferenceRoots.some((root) => absolute === root || absolute.startsWith(`${root}${path.sep}`))) continue;
    if (entry.isDirectory()) walk(absolute, out);
    else if (scanExtensions.has(path.extname(entry.name))) out.push(absolute);
  }
  return out;
}

for (const file of walk(ROOT)) {
  if (ignoredReferenceFiles.has(path.resolve(file))) continue;
  const source = fs.readFileSync(file, 'utf8');
  for (const removed of removedFiles) {
    assert.ok(!source.includes(removed), `Reference to removed ${removed} remains in ${path.relative(ROOT, file)}`);
  }
}

console.log(`Repository integrity OK: ${startupScripts.length} startup scripts, ${visited.size} runtime JS nodes checked`);
