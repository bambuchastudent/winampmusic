import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

const playerSource = fs.readFileSync('apple-musickit-v150.js', 'utf8');
const catalogSource = fs.readFileSync('apple-catalog-first-v150.js', 'utf8');
const indexSource = fs.readFileSync('index.html', 'utf8');
const pagesSource = fs.readFileSync('.github/workflows/pages.yml', 'utf8');

function makeDom() {
  return new JSDOM(`<!doctype html><html><head></head><body>
    <div id="status"></div><div id="nowTitle"></div><div id="nowArtist"></div>
    <span id="elapsed"></span><span id="duration"></span>
    <input id="seek" type="range" min="0" max="1000" value="0">
    <input id="volume" type="range" min="0" max="100" value="75">
    <button id="playButton">▶</button><button id="prevButton">⏮</button>
    <button id="nextButton">⏭</button><button id="shuffleButton">⤨</button>
    <ol id="trackList"><li class="track" data-index="0"><button class="track-main" data-index="0"></button><span class="track-play">▶</span></li></ol>
  </body></html>`, { url: 'https://bambuchastudent.github.io/winampmusic/', runScripts: 'outside-only' });
}

{
  const dom = makeDom();
  const { window } = dom;
  window.console = console;
  const track = {
    id: 'A000000TEST',
    title: 'Amulet',
    artist: 'Ext',
    appleTrackId: '1445697457',
    sourceUrl: 'https://music.apple.com/tr/album/amulet/1445697454?i=1445697457',
    badges: ['Apple Music', 'Apple catalog'],
  };
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([track]));
  window.localStorage.setItem('winampmusic.fast.current.v1', '0');
  window.AMP_MUSIC_APPLE_CONFIG = { enabled: true, developerToken: 'test-developer-token', app: { name: 'AmpMusic', build: '1.5.0' } };

  let baseCalls = 0;
  let directCalls = 0;
  let configureOptions = null;
  let authorizeCalls = 0;
  let queuedSong = '';
  let playCalls = 0;
  window.playIndex = () => { baseCalls += 1; return true; };
  window.ampMusicPlayDirectIndex = async () => { directCalls += 1; return true; };

  const music = {
    isAuthorized: false,
    volume: 0,
    currentPlaybackTime: 0,
    currentPlaybackDuration: 240,
    async authorize() { authorizeCalls += 1; this.isAuthorized = true; return 'music-user-token'; },
    async setQueue(value) { queuedSong = String(value?.song || ''); },
    async play() { playCalls += 1; },
    async pause() {},
    async stop() {},
    seekToTime() {},
  };
  window.MusicKit = {
    async configure(options) { configureOptions = options; return music; },
    getInstance() { return music; },
  };

  window.eval(playerSource);
  const result = await window.ampMusicAppleKit150.playPreferred(0);
  assert.equal(result, true);
  assert.equal(configureOptions.developerToken, 'test-developer-token');
  assert.equal(authorizeCalls, 1, 'subscriber authorization is requested inside AmpMusic');
  assert.equal(queuedSong, '1445697457', 'MusicKit queues the exact Apple catalog song id');
  assert.equal(playCalls, 1);
  assert.equal(directCalls, 0, 'YouTube/direct fallback is not used when MusicKit succeeds');
  assert.equal(baseCalls, 0, 'legacy YouTube iframe player is not used for successful Apple playback');
  assert.equal(window.document.getElementById('status').textContent, 'APPLE MUSIC · PLAYING');
  dom.window.close();
}

{
  const dom = makeDom();
  const { window } = dom;
  window.console = console;
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{
    id: 'A000000TEST', title: 'Amulet', artist: 'Ext', appleTrackId: '1445697457', badges: ['Apple Music'],
  }]));
  window.localStorage.setItem('winampmusic.fast.current.v1', '0');
  window.AMP_MUSIC_APPLE_CONFIG = { enabled: false, developerToken: '' };
  let directCalls = 0;
  let baseCalls = 0;
  window.playIndex = () => { baseCalls += 1; return true; };
  window.ampMusicPlayDirectIndex = async () => { directCalls += 1; return true; };
  window.eval(playerSource);
  const result = await window.ampMusicAppleKit150.playPreferred(0);
  assert.equal(result, true);
  assert.equal(directCalls, 1, 'without MusicKit credentials Apple playback stays in-player and uses direct YouTube fallback');
  assert.equal(baseCalls, 0, 'fallback does not invoke the YouTube iframe path');
  assert.equal(window.document.getElementById('status').textContent, 'YOUTUBE DIRECT · PLAYING');
  dom.window.close();
}

{
  const dom = makeDom();
  const { window } = dom;
  window.console = console;
  let strictSearchCalls = 0;
  let playedIndex = -1;
  window.ampMusicStrictMatcher150 = { async findYouTubeMatch() { strictSearchCalls += 1; throw new Error('must not search YouTube during Apple catalog import'); } };
  window.ampMusicPlayPreferredIndex = async (index) => { playedIndex = index; return true; };
  window.importTracks = (tracks) => {
    const library = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
    for (const track of tracks) if (!library.some((item) => item.id === track.id)) library.push(track);
    window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));
    return { added: tracks.length, total: library.length };
  };
  window.renderLibrary = () => {};
  window.winampMusicAppleImport = {
    parseUrl(value) { return value.includes('music.apple.com') ? { href: value, trackId: '1445697457', storefront: 'TR' } : null; },
    async lookup() { return { trackId: '1445697457', title: 'Amulet', artist: 'Ext', album: 'Amulet', durationMs: 231000, artwork: '', appleUrl: 'https://music.apple.com/tr/song/1445697457' }; },
    async findYouTubeMatch() { strictSearchCalls += 1; throw new Error('must not search'); },
  };
  window.eval(catalogSource);
  const handled = await window.winampMusicAppleImport.handleUrl('https://music.apple.com/tr/album/amulet/1445697454?i=1445697457', { play: true });
  assert.equal(handled, true);
  const library = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  assert.equal(library.length, 1);
  assert.equal(library[0].title, 'Amulet');
  assert.equal(library[0].artist, 'Ext');
  assert.equal(library[0].appleTrackId, '1445697457');
  assert.match(library[0].id, /^[A-Za-z0-9_-]{11}$/);
  assert.ok(library[0].badges.includes('Apple catalog'));
  assert.equal(strictSearchCalls, 0, 'Apple catalog track imports before any YouTube matching');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(playedIndex, 0);
  dom.window.close();
}

assert.doesNotMatch(playerSource, /window\.open\s*\(/);
assert.doesNotMatch(playerSource, /location\.assign\s*\(/);
assert.doesNotMatch(indexSource, /apple-url-route-v151\.js/);
assert.doesNotMatch(indexSource, /apple-no-ad-fallback-v150\.js/);
assert.match(indexSource, /apple-music-config\.js\?v=150/);
assert.match(indexSource, /apple-musickit-v150\.js\?v=150/);
assert.match(indexSource, /apple-catalog-first-v150\.js\?v=150/);
// The single music field must keep advertising all three import entities.
// Tolerates both the legacy "track/album/playlist" and the current "track, album, or playlist" copy.
assert.match(indexSource, /track[,/]\s*(?:or\s+)?album[,/]\s*(?:or\s+)?playlist/i);

assert.match(pagesSource, /APPLE_MUSIC_TEAM_ID: \$\{\{ secrets\.APPLE_MUSIC_TEAM_ID \}\}/);
assert.match(pagesSource, /APPLE_MUSIC_KEY_ID: \$\{\{ secrets\.APPLE_MUSIC_KEY_ID \}\}/);
assert.match(pagesSource, /APPLE_MUSIC_PRIVATE_KEY: \$\{\{ secrets\.APPLE_MUSIC_PRIVATE_KEY \}\}/);
assert.match(pagesSource, /generate-apple-music-config\.mjs/);

{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ampmusic-musickit-'));
  const out = path.join(tmp, 'apple-music-config.js');
  const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const run = spawnSync(process.execPath, ['scripts/generate-apple-music-config.mjs', out], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      APPLE_MUSIC_TEAM_ID: 'ABCDEFGHIJ',
      APPLE_MUSIC_KEY_ID: 'K123456789',
      APPLE_MUSIC_PRIVATE_KEY: pem,
      APPLE_MUSIC_ORIGIN: 'https://bambuchastudent.github.io',
    },
    encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  const generated = fs.readFileSync(out, 'utf8');
  assert.match(generated, /"enabled": true/);
  assert.match(generated, /developerToken/);
  assert.doesNotMatch(generated, /BEGIN PRIVATE KEY/, 'Pages artifact must never contain the Apple private key');
  const token = generated.match(/"developerToken": "([^"]+)"/)?.[1] || '';
  assert.equal(token.split('.').length, 3);
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  assert.equal(payload.iss, 'ABCDEFGHIJ');
  assert.deepEqual(payload.origin, ['https://bambuchastudent.github.io']);
  assert.ok(payload.exp > payload.iat);
}

console.log('AmpMusic 1.5 Apple MusicKit-first in-player playback: OK');
process.exit(0);
