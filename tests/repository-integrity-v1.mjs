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
const shareUi = read('share-ui-cleanup-v162.js');
const legacyShare = read('legacy-share-v1.js');
const shortLink = read('ampula-short-link-v163.js');
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
  'fast-background-v150.js','origin-playback-v151.js','v059.js','compact-share.js','share-ui-cleanup-v162.js',
  'legacy-share-v1.js','qr-share-v1.js','ampula-short-link-v163.js',
]) assert.ok(exists(file), `Missing protected current script: ${file}`);

assert.match(guard, /isPlaybackActive/);
assert.match(guard, /handleUrl/);
assert.match(html, /import-playback-guard-v159\.js\?v=159/);
assert.match(html, /<h1>Ámpula MP<\/h1>/);
assert.match(html, /id="headerSpectrum"/);
assert.match(visualizer, /MutationObserver/);

// Canonical Ámpula sharing remains lazy and self-contained. Historical p/s links are receive-only compatibility.
assert.match(fastActions, /loadScript\('\.\/share-ui-cleanup-v162\.js\?v=162', 'share-ui-cleanup'\)/);
assert.match(fastActions, /loadScript\('\.\/compact-share\.js\?v=164', 'compact-share'\)/);
assert.match(fastActions, /loadScript\('\.\/qr-share-v1\.js\?v=161', 'qr-share'\)/);
assert.match(fastActions, /loadScript\('\.\/legacy-share-v1\.js\?v=161', 'legacy-share'\)/);
assert.match(fastActions, /params\.has\('a'\)/);
assert.match(fastActions, /params\.has\('p'\).*params\.has\('s'\)/s);
assert.doesNotMatch(fastActions, /searchParams\.set\('p'/);
assert.doesNotMatch(fastActions, /searchParams\.set\('s'/);
assert.doesNotMatch(legacyShare, /searchParams\.set\('p'/);
assert.doesNotMatch(legacyShare, /searchParams\.set\('s'/);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*compact-share\.js/);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*legacy-share-v1\.js/);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*qr-share-v1\.js/);
assert.match(compactShare, /const AMPULA_PARAM = 'a'/);
assert.match(compactShare, /format: 'ampula'/);
assert.match(compactShare, /version: '1'/);
assert.match(compactShare, /function encodeAmpula/);
assert.match(compactShare, /function decodeAmpula/);
assert.match(compactShare, /function renderReceived/);
assert.match(compactShare, /SAVED_AMPULAS_KEY/);
assert.doesNotMatch(compactShare, /pastepile/i);
assert.doesNotMatch(compactShare, /parseCompactIds/);
assert.match(shareUi, /Share music/);
assert.match(shareUi, /winampShareFile/);
assert.match(shareUi, /Add to library/);
assert.match(shareUi, /findReceivedNotice/);
assert.match(shareUi, /node\.children\.length !== 0/);
assert.match(legacyShare, /LEGACY SHARE RESTORED/);
assert.match(legacyShare, /parseLegacyIds/);

// Short links are an optional transport alias: lazy, off the startup path, first-party only.
assert.match(fastActions, /loadScript\('\.\/ampula-short-link-v163\.js\?v=163', 'ampula-short-link'\)/);
assert.match(fastActions, /params\.has\('al'\)/);
assert.doesNotMatch(html, /<script[^>]+src=["'][^"']*ampula-short-link-v163\.js/);
assert.doesNotMatch(html, /AMPULA_SHORT_LINK_RELAY/);
assert.match(shortLink, /BLOCKED_HOSTS/);
assert.match(shortLink, /AbortController/);
assert.match(shortLink, /window\.ampulaShortLink = api/);
assert.doesNotMatch(shortLink, /importTracks/);
assert.doesNotMatch(shortLink, /winampmusic\.library\.v1/);
for (const source of [compactShare, fastActions, read('ampula-file-open-v1.js')]) {
  assert.match(source, /'al', 'p', 's', 'playlist'/, 'alias tokens must be stripped from rebuilt app URLs');
}
assert.ok(exists('relay/short-link/worker.js'), 'the deployable relay reference must be committed');
assert.ok(exists('relay/short-link/wrangler.toml'), 'the relay deployment configuration must be committed');
assert.ok(exists('scripts/create-short-link.mjs'), 'the relay-free static alias tool must be committed');
assert.doesNotMatch(read('relay/short-link/README.md'), /production relay is (?:live|running|deployed)/i);
assert.match(read('robots.txt'), /Disallow:\s*\/winampmusic\/a\//);

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

console.log(`Repository integrity OK: ${startupScripts.length} startup scripts, ${visited.size} runtime JS nodes, ${runtimeAssets.size} local runtime assets, canonical sharing + legacy recovery guarded`);
