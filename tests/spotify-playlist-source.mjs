import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../spotify-playlist-core-v160.js', import.meta.url), 'utf8');
const context = { globalThis: {}, URL };
vm.runInNewContext(source, context, { filename: 'spotify-playlist-core-v160.js' });
const core = context.globalThis.AmpulaSpotifyCore160;
assert.ok(core, 'Spotify core should expose parser helpers');

const direct = core.parseSource('https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L?si=abc');
assert.equal(direct?.playlistId, '3A4l0emm89zzee5bzE7E0L');
assert.equal(direct?.canonicalUrl, 'https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L');

const intl = core.parseSource('https://open.spotify.com/intl-es/playlist/3A4l0emm89zzee5bzE7E0L');
assert.equal(intl?.playlistId, '3A4l0emm89zzee5bzE7E0L');

const alias = core.parseSource('https://share.google/T0seuEuCz8Wdpksp3');
assert.equal(alias?.playlistId, '3A4l0emm89zzee5bzE7E0L');
assert.equal(alias?.title, 'Better Call Saul - soundtrack seasons 1 - 6 (Netflix and ABC)');

assert.equal(core.parseSource('https://open.spotify.com/track/abc123'), null);
assert.equal(core.parseSource('not a url'), null);

console.log('spotify playlist source contract: ok');
