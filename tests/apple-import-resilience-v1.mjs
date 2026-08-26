import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

// Encodes openspec/changes/apple-import-resilience-v1/specs/apple-import/spec.md

const core = fs.readFileSync('fast-player-v141.js', 'utf8');
const playlistAdapter = fs.readFileSync('apple-playlist-import-v150.js', 'utf8');
const catalogAdapter = fs.readFileSync('apple-catalog-first-v150.js', 'utf8');
const albumAdapter = fs.readFileSync('apple-album-import-v150.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8')
  .replace('<script src="./fast-player-v141.js?v=150"></script>', '')
  .replace('<script src="./fast-release-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-import-v150.js?v=150" defer></script>', '')
  .replace('<script src="./stable-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-actions-v143.js?v=150" defer></script>', '');

const PLAYLIST_URL = 'https://music.apple.com/tr/playlist/thexx/pl.u-V9D7mR7TaB8Zkl';
const TITLES = ['Intro', 'Infinity', 'Crystalised', 'Islands', 'Angels'];
const MATCH_IDS = {
  Intro: 'D7KW8me9c4A',
  Infinity: 'aaaaaaaaaaa',
  Crystalised: 'ddddddddddd',
  Islands: 'bbbbbbbbbbb',
  Angels: 'ccccccccccc',
  'Hollow Knight': 'hhhhhhhhhhh',
  'Crystal Peak': 'iiiiiiiiiii',
  Dirtmouth: 'jjjjjjjjjjj',
};

const song = (title, songId, albumId) => `[${title}](https://music.apple.com/tr/song/${title.toLowerCase()}/${songId})
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[xx](https://music.apple.com/tr/album/${title.toLowerCase()}/${albumId})
PREVIEW 2:07`;

const MARKDOWN = `Title: ‎thexx by Anastasiia Iangliaeva - Apple Music
URL Source: ${PLAYLIST_URL}
Markdown Content:
# thexx
Song Artist Album Time
${TITLES.map((title, index) => song(title, 1850810463 + index, 1850810462)).join('\n')}
`;

const NO_TRACK_MARKDOWN = `Title: ‎thexx by Anastasiia Iangliaeva - Apple Music
URL Source: ${PLAYLIST_URL}
Markdown Content:
# thexx
Sign In
Open in Music
`;

// A plain Apple table carries no song links, so no track has an Apple catalog id
// and the catalog-first path must fall through to the YouTube matcher.
const PLAIN_TITLES = ['Hollow Knight', 'Crystal Peak', 'Dirtmouth'];
const PLAIN_MARKDOWN = `Title: ‎Favorite Songs by Anastasiia Iangliaeva
URL Source: ${PLAYLIST_URL}
Markdown Content:
Favorite Songs
Preview
\t
Song
\t
Artist
\t
Album
\tTime
${PLAIN_TITLES.map((title) => `
\t
${title}
\t
Christopher Larkin
\t
Hollow Knight (Original Soundtrack)
\t
PREVIEW
1:36
`).join('')}`;

function boot({ matcher = 'all', markdown = MARKDOWN, ok = true, adapters = [playlistAdapter] } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/', pretendToBeVisual: true });
  const { window } = dom;
  window.console = console;
  const idle = [];
  window.requestIdleCallback = (callback) => { idle.push(callback); return idle.length; };
  window.cancelIdleCallback = () => {};

  const loaded = [];
  window.YT = {
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
    Player: class {
      constructor(_id, options) { this.options = options; queueMicrotask(() => options.events.onReady?.()); }
      setVolume() {}
      loadVideoById(id) { loaded.push(id); this.options.events.onStateChange?.({ data: 1 }); }
      getPlayerState() { return 2; }
      playVideo() {}
      pauseVideo() {}
      getDuration() { return 120; }
      getCurrentTime() { return 1; }
      seekTo() {}
    },
  };
  window.fetch = async (url) => {
    if (/r\.jina\.ai/.test(String(url))) return { ok, status: ok ? 200 : 502, text: async () => markdown };
    return { ok: false, status: 404, json: async () => [] };
  };

  if (matcher !== 'missing') {
    const matchCalls = new Map();
    window.winampMusicAppleImport = {
      async findYouTubeMatch(meta) {
        if (matcher === 'none') return null;
        if (matcher === 'not-first' && meta.title === 'Intro') throw new Error('simulated unresolved track');
        if (matcher === 'all-but-one' && meta.title === 'Crystalised') throw new Error('simulated unresolved track');
        if (matcher === 'plain-all-but-one' && meta.title === 'Crystal Peak') throw new Error('simulated unresolved track');
        if (matcher === 'drifting') {
          const seen = (matchCalls.get(meta.title) || 0) + 1;
          matchCalls.set(meta.title, seen);
          const stable = MATCH_IDS[meta.title];
          return { id: seen > 1 ? `z${stable.slice(1)}` : stable, title: meta.title, artist: meta.artist, duration: 120, thumbnail: '' };
        }
        return { id: MATCH_IDS[meta.title], title: meta.title, artist: meta.artist, duration: 120, thumbnail: '' };
      },
    };
  }

  window.eval(core);
  for (const adapter of adapters) window.eval(adapter);

  const saved = () => JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  const statuses = [];
  const importPlaylist = (options = {}) => window.ampMusicApplePlaylist150.importPlaylistUrl(PLAYLIST_URL, {
    onStatus: (state) => statuses.push(state),
    ...options,
  });
  return { dom, window, loaded, saved, statuses, importPlaylist };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

// Requirement: Reading and resolving are separate outcomes
{
  const { dom, saved, statuses, importPlaylist } = boot({ ok: false });
  const result = await importPlaylist();
  assert.ok(result.error, 'a reader transport failure must be reported as an error');
  assert.equal(saved().length, 0, 'nothing may be imported when the page could not be read');
  assert.ok(statuses.some((state) => state.phase === 'error'), 'the error phase must be reported');
  dom.window.close();
}

{
  const { dom, saved, statuses, importPlaylist } = boot({ markdown: NO_TRACK_MARKDOWN });
  const result = await importPlaylist();
  assert.ok(!result.error, 'a playlist with no readable tracks is not an import failure');
  assert.equal(result.empty, true, 'the empty outcome must be reported to the caller');
  assert.equal(saved().length, 0);
  assert.ok(!statuses.some((state) => state.phase === 'error'), 'an empty playlist must not use the error phase');
  assert.ok(statuses.some((state) => /no readable tracks/i.test(state.message || '')), 'the user must be told the playlist had no readable tracks');
  dom.window.close();
}

// Requirement: Every recording that was read is imported
{
  const { dom, saved, importPlaylist } = boot({ matcher: 'all-but-one' });
  const result = await importPlaylist({ play: false });
  assert.equal(result.playlist.tracks.length, 5);
  const library = saved();
  assert.equal(library.length, 5, 'an unmatched track must not be dropped');
  assert.deepEqual(library.map((track) => track.title), TITLES, 'Apple order must be preserved');
  const unmatched = library[2];
  assert.equal(unmatched.title, 'Crystalised');
  assert.equal(unmatched.artist, 'The xx');
  assert.equal(unmatched.album, 'xx');
  dom.window.close();
}

{
  const { dom, saved, statuses, importPlaylist } = boot({ matcher: 'none' });
  const result = await importPlaylist({ play: false });
  assert.ok(!result.error, 'a playlist where nothing matched must not be an error');
  assert.equal(saved().length, 5, 'every readable track must be imported as unresolved');
  assert.ok(!statuses.some((state) => state.phase === 'error'));
  dom.window.close();
}

{
  const { dom, window, saved, importPlaylist } = boot({ matcher: 'missing' });
  await importPlaylist({ play: false });
  const library = saved();
  assert.equal(library.length, 5, 'a missing matcher must not lose the playlist');
  assert.ok(library.every((track) => window.ampMusicIsResolved(track) === false));
  dom.window.close();
}

// Requirement: An unresolved import keeps its Apple evidence
{
  const { dom, window, saved, importPlaylist } = boot({ matcher: 'all-but-one' });
  await importPlaylist({ play: false });
  const unmatched = saved()[2];
  assert.equal(window.ampMusicIsResolved(unmatched), false, 'the unmatched track must be unresolved');
  assert.equal(unmatched.id, window.ampMusicRecordingId('Crystalised', 'The xx'), 'the library must assign the local recording id');
  assert.match(unmatched.appleTrackUrl, /music\.apple\.com\/tr\/song\/crystalised/, 'the Apple URL must be retained');

  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  const dialogProto = window.HTMLDialogElement?.prototype;
  if (dialogProto && typeof dialogProto.showModal !== 'function') {
    dialogProto.showModal = function showModal() { this.setAttribute('open', ''); };
    dialogProto.close = function close() { this.removeAttribute('open'); };
  }
  window.eval(fs.readFileSync('compact-share.js', 'utf8'));
  const ampula = window.winampMusicCompactShare.toAmpula(saved());
  const shared = ampula.tracks[2];
  assert.equal(shared.title, 'Crystalised');
  assert.deepEqual(Array.from(shared.artists), ['The xx']);
  const observations = Array.from(shared.observations || []);
  assert.ok(observations.some((obs) => obs.service === 'apple-music'), 'the Apple URL must survive as a historical observation');
  assert.ok(!observations.some((obs) => obs.service === 'youtube'), 'no YouTube observation may be fabricated for an unresolved track');
  dom.window.close();
}

// Requirement: Playback starts on a playable track
{
  const { dom, loaded, importPlaylist } = boot({ matcher: 'not-first' });
  await importPlaylist({ play: true });
  await settle();
  assert.deepEqual(loaded, [MATCH_IDS.Infinity], 'playback must start on the first playable track');
  dom.window.close();
}

{
  const { dom, loaded, importPlaylist } = boot({ matcher: 'none' });
  await importPlaylist({ play: true });
  await settle();
  assert.deepEqual(loaded, [], 'playback must not start when nothing is playable');
  dom.window.close();
}

// Requirement: The import reports what happened
{
  const { dom, statuses, importPlaylist } = boot({ matcher: 'all-but-one' });
  await importPlaylist({ play: false });
  const done = statuses.find((state) => state.phase === 'done');
  assert.ok(done, 'a done status must be reported');
  assert.match(done.message, /5 tracks/);
  assert.match(done.message, /4 matched/);
  assert.match(done.message, /1 unresolved/);
  dom.window.close();
}

{
  const { dom, statuses, importPlaylist } = boot({ matcher: 'all' });
  await importPlaylist({ play: false });
  const done = statuses.find((state) => state.phase === 'done');
  assert.doesNotMatch(done.message, /unresolved/, 'a fully matched import must not mention unresolved tracks');
  dom.window.close();
}

// Requirement: Re-importing does not duplicate a recording
{
  const { dom, saved, importPlaylist } = boot({ matcher: 'all-but-one' });
  await importPlaylist({ play: false });
  const first = saved().length;
  await importPlaylist({ play: false });
  assert.equal(saved().length, first, 're-importing the same playlist must not duplicate recordings');
  dom.window.close();
}

// A matcher is not deterministic: the same recording can resolve to a different
// playable id on a later run, and that must not become a second recording.
{
  const { dom, saved, importPlaylist } = boot({ matcher: 'drifting' });
  await importPlaylist({ play: false });
  const first = saved();
  assert.equal(first.length, 5);
  await importPlaylist({ play: false });
  const second = saved();
  assert.equal(second.length, 5, 'a drifting matcher must not duplicate recordings on re-import');
  assert.deepEqual(second.map((track) => track.id), first.map((track) => track.id), 'the handle already in use must be kept');
  dom.window.close();
}

{
  const { dom, saved, importPlaylist } = boot({
    matcher: 'drifting',
    markdown: PLAIN_MARKDOWN,
    adapters: [playlistAdapter, catalogAdapter],
  });
  await importPlaylist({ play: false });
  await importPlaylist({ play: false });
  assert.equal(saved().length, PLAIN_TITLES.length, 'the catalog-first path must not duplicate a recording that resolved to a different id');
  dom.window.close();
}

// Requirement: Every recording that was read is imported — catalog-first path
{
  const { dom, window, saved, importPlaylist } = boot({ matcher: 'all-but-one', adapters: [playlistAdapter, catalogAdapter] });
  assert.equal(window.ampMusicApplePlaylist150.__ampCatalogFirst150, true, 'the catalog-first patch must be active');
  await importPlaylist({ play: false });
  const library = saved();
  assert.equal(library.length, 5, 'the catalog-first path must not drop a track');
  assert.ok(library.some((track) => track.title === 'Crystalised'));
  dom.window.close();
}

// A plain Apple table has no catalog ids, so the catalog-first path must fall
// through to the matcher and keep whatever the matcher cannot resolve.
{
  const { dom, window, saved, importPlaylist } = boot({
    matcher: 'plain-all-but-one',
    markdown: PLAIN_MARKDOWN,
    adapters: [playlistAdapter, catalogAdapter],
  });
  await importPlaylist({ play: false });
  const library = saved();
  assert.deepEqual(library.map((track) => track.title), PLAIN_TITLES, 'the catalog-first fallback must keep every read track in order');
  assert.equal(window.ampMusicIsResolved(library[1]), false, 'the unmatched fallback track must be unresolved');
  assert.equal(library[1].artist, 'Christopher Larkin', 'the unmatched fallback track must keep its Apple metadata');
  assert.equal(window.ampMusicIsResolved(library[0]), true);
  dom.window.close();
}

{
  const { dom, saved, statuses, importPlaylist } = boot({
    markdown: NO_TRACK_MARKDOWN,
    adapters: [playlistAdapter, catalogAdapter],
  });
  const result = await importPlaylist({ play: false });
  assert.ok(!result.error, 'the catalog-first path must not turn an empty playlist into an error');
  assert.equal(saved().length, 0);
  assert.ok(!statuses.some((state) => state.phase === 'error'));
  dom.window.close();
}

{
  const { dom, saved, importPlaylist } = boot({
    matcher: 'plain-all-but-one',
    markdown: PLAIN_MARKDOWN,
    adapters: [playlistAdapter, catalogAdapter],
  });
  await importPlaylist({ play: false });
  const first = saved().length;
  await importPlaylist({ play: false });
  assert.equal(saved().length, first, 'the catalog-first path must not duplicate an unresolved recording');
  dom.window.close();
}

// Requirement: Every recording that was read is imported — album path
{
  const ALBUM_URL = 'https://music.apple.com/tr/album/last-october/1445697454';
  const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/', pretendToBeVisual: true });
  const { window } = dom;
  window.console = console;
  window.requestIdleCallback = () => 1;
  window.YT = { PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 }, Player: class { constructor(_i, o) { this.options = o; queueMicrotask(() => o.events.onReady?.()); } setVolume() {} loadVideoById() {} getPlayerState() { return 2; } playVideo() {} pauseVideo() {} getDuration() { return 1; } getCurrentTime() { return 0; } seekTo() {} } };
  window.winampMusicAppleImport = {
    __ampStrict150: true,
    async findYouTubeMatch(meta) {
      if (meta.title === 'Unexpected Song') throw new Error('simulated unresolved track');
      return { id: 'bbbbbbbbbbb', title: meta.title, artist: meta.artist, duration: 210 };
    },
  };
  const originalAppend = window.document.head.appendChild.bind(window.document.head);
  window.document.head.appendChild = (node) => {
    const result = originalAppend(node);
    if (node.tagName === 'SCRIPT' && /itunes\.apple\.com\/lookup/.test(node.src || '')) {
      const callback = new URL(node.src).searchParams.get('callback');
      queueMicrotask(() => window[callback]({
        results: [
          { wrapperType: 'collection', collectionId: 1445697454, collectionName: 'Last October', artistName: 'Last October' },
          { wrapperType: 'track', kind: 'song', collectionId: 1445697454, trackId: 1445697455, trackNumber: 1, trackName: 'Unexpected Song', artistName: 'Last October', collectionName: 'Last October', trackTimeMillis: 180000, trackViewUrl: 'https://music.apple.com/tr/song/1445697455' },
          { wrapperType: 'track', kind: 'song', collectionId: 1445697454, trackId: 1445697456, trackNumber: 2, trackName: "An Angel's Touch", artistName: 'Last October', collectionName: 'Last October', trackTimeMillis: 210000, trackViewUrl: 'https://music.apple.com/tr/song/1445697456' },
        ],
      }));
    }
    return result;
  };
  window.eval(core);
  window.eval(albumAdapter);
  const result = await window.ampMusicAppleAlbum150.importAlbumUrl(ALBUM_URL, { play: false });
  assert.ok(!result.error, 'an album with one unmatched track must not fail');
  const library = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  assert.equal(library.length, 2, 'every album track must be imported');
  assert.equal(library[0].title, 'Unexpected Song');
  assert.equal(window.ampMusicIsResolved(library[0]), false, 'the unmatched album track must be unresolved');
  assert.equal(window.ampMusicIsResolved(library[1]), true);
  dom.window.close();
}

console.log('Apple import resilience v1 test passed');
process.exit(0);
