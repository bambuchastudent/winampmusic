import assert from 'node:assert/strict';
import fs from 'node:fs';

const sw = fs.readFileSync('sw.js', 'utf8');
const boot = fs.readFileSync('boot-v134.js', 'utf8');
const recover = fs.readFileSync('recover.html', 'utf8');

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

assert.match(recover, /register\('\.\/sw\.js',\s*\{\s*updateViaCache:\s*'none'\s*\}\)/, 'recovery must install the fresh canonical worker before reopening');
assert.match(recover, /recovered=136/, 'recovery marker must identify this runtime repair');
assert.doesNotMatch(recover, /localStorage\.(?:clear|removeItem)/, 'recovery must not delete the user music library');

console.log('v1.3.6 runtime cache regression guard: passed');
