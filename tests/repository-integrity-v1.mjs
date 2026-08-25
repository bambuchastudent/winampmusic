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
const compactShare = read('compact-share.js');
const guard = read('import-playback-guard-v159.js');
const visualizer = read('header-visualizer-v159.js');

const startupScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)]
  .map((match) => match[1]).filter((src) => !/^(?:[a-z]+:)?\/\//i.test(src)).map(rel);
assert.ok(startupScripts.length > 0);
for (const script of startupScripts) assert.ok(exists(script), `Missing index script: ${script}`);

const queue = [...new Set([...startupScripts, 'sw.js'])];
const visited = new Set();
const runtimeAssets = new Set();
while (queue.length) {
  const file = queue.shift();
  if (visited.has(file)) continue;
  visited.add(file);
  assert.ok(exists(file), `Missing runtime graph file: ${file}`);
  const source = read(file);
  for (const match of source.matchAll(/["'`]((?![a-z]+:|\/\/)(?:\.\/)?[A-Za-z0-9_./-]+\.(?:js|css))(?:\?[^"'`]*)?["'`]/gi)) {
    const target = rel(match[1]);
    if (!target || target.startsWith('../')) continue;
    runtimeAssets.add(target);
    assert.ok(exists(target), `Missing lazy/runtime asset ${target} referenced by ${file}`);
    if (target.endsWith('.js') && !visited.has(target)) queue.push(target);
  }
}

for (const match of sw.matchAll(/["'](\.\/[^"']+)["']/g)) {
  const target = rel(match[1]);
  if (target && /\.[a-z0-9]+$/i.test(target)) assert.ok(exists(target), `Missing service-worker target: ${target}`);
}

const manifest = JSON.parse(read('manifest.webmanifest'));
for (const icon of manifest.icons || []) if (typeof icon?.src === 'string' && !/^(?:[a-z]+:)?\/\//i.test(icon.src)) assert.ok(exists(icon.src));

for (const file of [
  'fast-player-v141.js','clean-playback-v150.js','apple-catalog-first-v150.js','apple-musickit-v150.js',
  'unified-entry-v152.js','import-playback-guard-v159.js','header-visualizer-v159.js','fast-actions-v143.js',
  'fast-import-v150.js','apple-music-import-v064.js','apple-playlist-import-v150.js','apple-album-import-v150.js',
  'fast-background-v150.js','origin-playback-v151.js','v059.js','compact-share.js','qr-share-v1.js',
]) assert.ok(exists(file), `Missing protected current script: ${file}`);

assert.match(guard, /isPlaybackActive/);
assert.match(guard, /handleUrl/);
assert.match(html, /import-playback-guard-v159\.js\?v=159/);
assert.match(html, /<h1>Ámpula MP<\/h1>/);
assert.match(html, /id="headerSpectrum"/);
assert.match(visualizer, /MutationObserver/);

// Ámpula sharing is lazy, self-contained, provider-independent and non-destructive on open.
assert.match(fastActions, /loadScript\('\.\/compact-share\.js\?v=160', 'compact-share'\)/);
assert.match(fastActions, /loadScript\('\.\/qr-share-v1\.js\?v=160', 'qr-share'\)/);
assert.match(fastActions, /params\.has\('a'\)/);
assert.doesNotMatch(fastActions, /searchParams\.set\('p'/);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*compact-share\.js/);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*qr-share-v1\.js/);
assert.match(compactShare, /const AMPULA_PARAM = 'a'/);
assert.match(compactShare, /format: 'ampula'/);
assert.match(compactShare, /version: '1'/);
assert.match(compactShare, /function encodeAmpula/);
assert.match(compactShare, /function decodeAmpula/);
assert.match(compactShare, /function renderReceived/);
assert.match(compactShare, /Opening this Ámpula does not change Your library/);
assert.match(compactShare, /SAVED_AMPULAS_KEY/);
assert.doesNotMatch(compactShare, /pastepile/i);
assert.doesNotMatch(compactShare, /parseCompactIds/);

const compatibilitySource = [read('fast-player-v141.js'), fastActions, read('fast-background-v150.js'), read('origin-playback-v151.js')].join('\n');
for (const key of ['winampmusic.library.v1','winampmusic.fast.current.v1','winampmusic.player.v1','winampmusic.background.v1']) {
  assert.ok(compatibilitySource.includes(key), `Missing compatibility storage key: ${key}`);
}

const pagesWorkflow = read('.github/workflows/pages.yml');
assert.match(pagesWorkflow, /scripts\/generate-apple-music-config\.mjs apple-music-config\.js/);
assert.ok(exists('scripts/generate-apple-music-config.mjs'));

const removalLedger = 'tests/repository-removed-files-v1.json';
const removedFiles = JSON.parse(read(removalLedger));
for (const removed of removedFiles) assert.ok(!exists(removed), `Removed file still exists: ${removed}`);

console.log(`Repository integrity OK: ${startupScripts.length} startup scripts, ${visited.size} runtime JS nodes, ${runtimeAssets.size} local runtime assets, Ámpula v1 sharing guarded`);
