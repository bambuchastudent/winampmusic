import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const resolverSource = fs.readFileSync('apple-resolution-v162.js', 'utf8');
const releaseSource = fs.readFileSync('fast-release-v150.js', 'utf8');
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function legacyAppleLocalId(trackId) {
  const encoded = BigInt(String(trackId)).toString(36).toUpperCase();
  return `A${encoded.padStart(10, '0').slice(-10)}`;
}

function makeDom() {
  return new JSDOM(`<!doctype html><html><head></head><body>
    <div id="status"></div><div id="songSearchStatus"></div>
    <ol id="trackList"></ol>
  </body></html>`, {
    url: 'https://bambuchastudent.github.io/winampmusic/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
}

function installLibrary(window) {
  const keyFor = (track) => `${String(track?.title || '').toLowerCase()}\u0000${String(track?.artist || '').toLowerCase()}`;
  window.ampMusicRecordingId = (title, artist) => `U-${String(title || '').toLowerCase()}-${String(artist || '').toLowerCase()}`;
  window.importTracks = (tracks) => {
    const library = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
    let added = 0;
    for (const incoming of tracks || []) {
      const index = library.findIndex((item) =>
        (incoming?.id && item?.id === incoming.id)
        || (incoming?.appleTrackId && item?.appleTrackId === incoming.appleTrackId)
        || keyFor(item) === keyFor(incoming));
      if (index >= 0) {
        library[index] = {
          ...library[index],
          ...incoming,
          id: VIDEO_ID_RE.test(String(incoming?.id || '')) ? incoming.id : library[index].id,
        };
        continue;
      }
      library.push({
        ...incoming,
        id: VIDEO_ID_RE.test(String(incoming?.id || ''))
          ? incoming.id
          : window.ampMusicRecordingId(incoming?.title, incoming?.artist),
      });
      added += 1;
    }
    window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));
    return { added, total: library.length };
  };
  window.renderLibrary = () => {};
}

// Album catalog IDs are evidence, not fake YouTube handles. Real full sources are
// resolved track by track and only those are counted as playable.
{
  const dom = makeDom();
  const { window } = dom;
  window.console = console;
  installLibrary(window);

  const albumUrl = 'https://music.apple.com/tr/album/200-po-vstrechnoy/1887888421';
  const album = {
    name: '200 по встречной',
    tracks: [
      {
        appleTrackId: '1887888422',
        title: 'Клоуны',
        artist: 't.A.T.u.',
        album: '200 по встречной',
        durationMs: 209000,
        artwork: '',
        appleUrl: `${albumUrl}?i=1887888422`,
      },
      {
        appleTrackId: '1887888423',
        title: '30 минут',
        artist: 't.A.T.u.',
        album: '200 по встречной',
        durationMs: 198000,
        artwork: '',
        appleUrl: `${albumUrl}?i=1887888423`,
      },
    ],
  };

  window.ampMusicStrictMatcher150 = {
    async findYouTubeMatch(metadata) {
      if (metadata.title === 'Клоуны') return { id: 'VcOwwW5M8Sk', title: 'Клоуны', artist: 't.A.T.u.', duration: 209 };
      throw new Error('simulated no safe full source');
    },
  };
  window.winampMusicAppleImport = { async findYouTubeMatch(meta) { return window.ampMusicStrictMatcher150.findYouTubeMatch(meta); } };
  window.ampMusicAppleAlbum150 = {
    parseAlbumUrl(value) { return value.includes('music.apple.com') ? { href: value, albumId: '1887888421', storefront: 'TR' } : null; },
    async lookupAlbumJsonp() { return album; },
    async importAlbumUrl() { throw new Error('resolver patch did not install'); },
  };
  let playedIndex = -1;
  window.ampMusicPlayPreferredIndex = async (index) => { playedIndex = index; return true; };

  window.eval(resolverSource);
  assert.equal(window.ampMusicAppleAlbum150.__ampFullResolver162, true, 'full resolver must own final album import');
  const statuses = [];
  const result = await window.ampMusicAppleAlbum150.importAlbumUrl(albumUrl, {
    play: true,
    onStatus: (state) => statuses.push(state),
  });

  assert.equal(result.matched, 1);
  assert.equal(result.unresolved, 1);
  assert.equal(result.tracks[0].id, 'VcOwwW5M8Sk');
  assert.equal(result.tracks[0].appleTrackId, '1887888422', 'Apple evidence must survive a YouTube resolution');
  assert.equal(result.tracks[1].id, undefined, 'an unresolved Apple track must not receive a synthetic playable id');
  assert.equal(result.tracks[1].appleTrackId, '1887888423', 'unresolved Apple evidence must be preserved');
  assert.ok(!result.tracks.some((track) => /^A[A-Z0-9]{10}$/.test(String(track?.id || ''))), 'catalog IDs must never masquerade as YouTube ids');

  const done = statuses.find((state) => state.phase === 'done');
  assert.ok(done);
  assert.match(done.message, /2 tracks/);
  assert.match(done.message, /1 playable/);
  assert.match(done.message, /1 unresolved/);
  assert.equal(done.matched, 1);
  assert.equal(playedIndex, 0, 'Add & Play starts the first real full source');

  const saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  assert.equal(saved.length, 2);
  assert.equal(saved[0].id, 'VcOwwW5M8Sk');
  assert.ok(String(saved[1].id).startsWith('U-'));
  dom.window.close();
}

// Libraries created by the broken catalog-first build are migrated away from
// synthetic Axxxxxxxxxx handles before another import/resolution pass.
{
  const dom = makeDom();
  const { window } = dom;
  window.console = console;
  window.setTimeout = () => 0; // do not navigate jsdom after the migration assertion
  const appleTrackId = '1445697457';
  const fakeId = legacyAppleLocalId(appleTrackId);
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{
    id: fakeId,
    title: 'Amulet',
    artist: 'Ext',
    appleTrackId,
    badges: ['Apple Music', 'Apple catalog'],
  }]));

  window.eval(resolverSource);
  const saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  assert.equal(window.__AMP_MUSIC_APPLE_MIGRATED_162__, true);
  assert.notEqual(saved[0].id, fakeId);
  assert.ok(String(saved[0].id).startsWith('U-'));
  assert.ok(saved[0].badges.includes('Unresolved'));
  dom.window.close();
}

// If direct/proxy audio fails after a real YouTube source has been resolved,
// the original iframe player remains a full-track fallback instead of ending in
// NO PLAYABLE SOURCE.
{
  const dom = makeDom();
  const { window } = dom;
  window.console = console;
  window.requestIdleCallback = () => 1;
  let legacyCalls = 0;
  window.playIndex = async (index) => { legacyCalls += 1; assert.equal(index, 0); return true; };
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{
    id: 'VcOwwW5M8Sk',
    title: 'Клоуны',
    artist: 't.A.T.u.',
    appleTrackId: '1887888422',
    badges: ['Apple Music', 'YouTube match'],
  }]));

  window.eval(releaseSource);
  window.ampMusicPlayDirectIndex = async () => false;
  const result = await window.ampMusicPlayDirectIndex(0);
  assert.equal(result, true);
  assert.equal(legacyCalls, 1, 'real resolved Apple-origin tracks fall back to the YouTube iframe player');

  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{
    id: legacyAppleLocalId('1887888422'),
    title: 'Клоуны',
    artist: 't.A.T.u.',
    appleTrackId: '1887888422',
    badges: ['Apple Music'],
  }]));
  const syntheticResult = await window.ampMusicPlayDirectIndex(0);
  assert.equal(syntheticResult, false);
  assert.equal(legacyCalls, 1, 'legacy synthetic Apple IDs must never be sent to YouTube');
  dom.window.close();
}

assert.match(releaseSource, /apple-resolution-v162\.js\?v=162/);
assert.doesNotMatch(resolverSource, /previewUrl|preview\.mp3|audio-preview/i, '90-second Apple previews are not a normal playback source');

console.log('AmpMusic Apple full-source resolution 1.6.2: OK');
process.exit(0);
