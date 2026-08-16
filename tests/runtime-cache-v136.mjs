import assert from 'node:assert/strict';
import fs from 'node:fs';

const sw = fs.readFileSync('sw.js', 'utf8');
const boot = fs.readFileSync('boot-v134.js', 'utf8');
const recover = fs.readFileSync('recover.html', 'utf8');
const freshRecover = fs.readFileSync('recover-fresh-137.html', 'utf8');

assert.match(sw, /v1\.3\.6-runtime-self-heal/, 'service worker must expose the current runtime build');
assert.match(sw, /cache:\s*'no-store'/, 'runtime fetches must bypass browser HTTP cache');
assert.match(sw, /event\.respondWith\(networkFirst\(event\.request\)\)/, 'all same-origin runtime requests must be network-first');
assert.doesNotMatch(sw, /cachedShellFirst/, 'cache-first JavaScript must never return');
assert.match(sw, /client\.navigate\(client\.url\)/, 'a newly activated worker must replace an already-open stale player once');
assert.match(sw, /recover\.html/, 'activation reload must explicitly exclude the recovery page');

assert.match(boot, /__WINAMP_MUSIC_RUNTIME__\s*=\s*'1\.3\.6'/, 'page must expose an inspectable runtime build id');
assert.match(boot, /winampMusicLoadYouTubeApi\s*=\s*loadYouTubeApi/, 'YouTube loader must be exported for diagnostics and playback');
assert.match(boot, /register\('\.\/sw\.js',\s*\{\s*updateViaCache:\s*'none'\s*\}\)/, 'boot must register one canonical uncached worker');
assert.doesNotMatch(boot, /register\('\.\/sw-v135\.js'/, 'legacy competing worker registration must not return');

assert.match(recover, /recover-fresh-137\.html/, 'canonical recovery must route through a never-before-cached entrypoint');
assert.match(freshRecover, /register\(`\.\/sw\.js\?fresh=/, 'fresh recovery must install a unique canonical worker URL');
assert.match(freshRecover, /updateViaCache:\s*'none'/, 'fresh recovery worker install must bypass HTTP cache');
assert.match(freshRecover, /fetch\(bootUrl,\s*\{\s*cache:\s*'no-store'\s*\}\)/, 'fresh recovery must verify boot from the network before reopening');
assert.match(freshRecover, /__WINAMP_MUSIC_RUNTIME__ = '1\.3\.6'/, 'fresh recovery must verify the current runtime marker');
assert.doesNotMatch(recover + freshRecover, /localStorage\.(?:clear|removeItem)/, 'recovery must not delete the user music library');

console.log('v1.3.6 runtime cache regression guard: passed via fresh recovery entrypoint');
