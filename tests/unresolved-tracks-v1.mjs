import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

// Encodes openspec/changes/unresolved-tracks-v1/specs/music-library/spec.md

const core = fs.readFileSync('fast-player-v141.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const html = index
  .replace('<script src="./fast-player-v141.js?v=150"></script>', '')
  .replace('<script src="./fast-release-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-import-v150.js?v=150" defer></script>', '')
  .replace('<script src="./stable-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-actions-v143.js?v=150" defer></script>', '');

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function boot({ stored = [], search = null } = {}) {
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'https://example.test/winampmusic/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const idle = [];
  window.requestIdleCallback = (callback) => { idle.push(callback); return idle.length; };
  window.cancelIdleCallback = () => {};
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(stored));

  const loaded = [];
  const searched = [];
  window.fetch = async (url) => {
    searched.push(String(url));
    if (!search) return { ok: false, json: async () => [] };
    return { ok: true, json: async () => [{ type: 'video', videoId: search, title: 'found', author: 'found' }] };
  };
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
  window.eval(core);
  const drain = () => { while (idle.length) idle.shift()({ didTimeout: false, timeRemaining: () => 50 }); };
  const saved = () => JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  return { dom, window, loaded, searched, drain, saved };
}

// Requirement: A recording is identified by title and artist
{
  const { dom, window, saved } = boot();
  const result = window.importTracks([{ title: 'Teardrop', artist: 'Massive Attack' }]);
  assert.equal(result.added, 1, 'a recording without a provider identifier must be added');
  assert.equal(result.total, 1);
  const [track] = saved();
  assert.equal(track.title, 'Teardrop', 'title must be preserved');
  assert.equal(track.artist, 'Massive Attack', 'artist must be preserved');
  assert.ok(track.id, 'an unresolved track must carry a local identifier');
  assert.ok(!VIDEO_ID_RE.test(track.id), `local identifier ${track.id} must not look like a YouTube id`);
  assert.equal(window.ampMusicVideoIdFromValue(track.id), '', 'provider normalization must reject the local identifier');
  assert.equal(window.document.getElementById('trackCount').textContent, '1');
  dom.window.close();
}

{
  const { dom, window } = boot();
  const result = window.importTracks([{ id: '', title: '', artist: '' }]);
  assert.equal(result.added, 0, 'an item with neither a handle nor a name is not a recording');
  dom.window.close();
}

// Requirement: Stored identity is never manufactured from a provider handle
{
  const { dom, window, saved } = boot();
  assert.equal(window.importTracks([{ id: 'dQw4w9WgXcQ' }]).added, 1);
  const [track] = saved();
  assert.equal(track.id, 'dQw4w9WgXcQ');
  assert.ok(!String(track.title || '').includes('dQw4w9WgXcQ'), 'stored title must not contain the provider handle');
  assert.notEqual(track.artist, 'YouTube', 'stored artist must not be the provider name');
  dom.window.close();
}

{
  const stored = [{ id: 'aqz-KE-bpKQ' }];
  const { dom, saved } = boot({ stored });
  const [track] = saved();
  assert.ok(!String(track.title || '').includes('aqz-KE-bpKQ'), 'reading must not invent a title');
  assert.notEqual(track.artist, 'YouTube', 'reading must not invent an artist');
  dom.window.close();
}

// Requirement: Missing metadata is resolved at display time
{
  const { dom, window, saved } = boot({ stored: [{ id: 'aqz-KE-bpKQ' }] });
  const row = window.document.querySelector('.track');
  assert.ok(row, 'a track with no metadata must still render');
  const shownTitle = row.querySelector('.track-title').textContent.trim();
  const shownArtist = row.querySelector('.track-artist').textContent.trim();
  assert.ok(shownTitle.length > 0, 'the row must show a human-readable placeholder title');
  assert.ok(!shownTitle.includes('aqz-KE-bpKQ'), 'the displayed placeholder must not be the provider handle');
  assert.ok(shownArtist.length > 0, 'the row must show a human-readable placeholder artist');
  const [track] = saved();
  assert.ok(!clean(track.title), 'the display fallback must not be persisted as a title');
  assert.ok(!clean(track.artist), 'the display fallback must not be persisted as an artist');
  dom.window.close();
}

function clean(value) { return String(value ?? '').replace(/\s+/g, ' ').trim(); }

// Requirement: Unresolved tracks stay visible and ordered
{
  const { dom, window, drain } = boot();
  window.importTracks([
    { id: 'dQw4w9WgXcQ', title: 'Playable', artist: 'One' },
    { title: 'Teardrop', artist: 'Massive Attack' },
  ]);
  drain();
  const rows = Array.from(window.document.querySelectorAll('.track'));
  assert.equal(window.document.getElementById('trackCount').textContent, '2');
  assert.equal(rows.length, 2, 'an unresolved track must be listed like a playable one');
  assert.equal(rows[0].querySelector('.track-title').textContent, 'Playable', 'order must be preserved');
  assert.equal(rows[1].querySelector('.track-title').textContent, 'Teardrop');
  assert.ok(!rows[0].classList.contains('unresolved'), 'a playable row must not be marked unresolved');
  assert.ok(rows[1].classList.contains('unresolved'), 'an unresolved row must be marked unresolved');

  const search = window.document.getElementById('search');
  search.value = 'teardrop';
  search.dispatchEvent(new window.Event('input', { bubbles: true }));
  const filteredRows = Array.from(window.document.querySelectorAll('.track'));
  assert.equal(filteredRows.length, 1, 'search must match an unresolved track');
  assert.equal(filteredRows[0].querySelector('.track-title').textContent, 'Teardrop');
  dom.window.close();
}

// Requirement: A local identifier is never offered to a provider
{
  const { dom, window, loaded, drain, saved } = boot({ search: null });
  window.importTracks([{ title: 'Future Track', artist: 'Unknown Artist' }]);
  drain();
  await window.playIndex(0);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(loaded, [], 'a local identifier must never reach provider playback');
  const [track] = saved();
  assert.equal(track.title, 'Future Track', 'a failed match must not delete the recording');
  assert.equal(track.artist, 'Unknown Artist');
  assert.match(window.document.getElementById('status').textContent, /NO SOURCE FOUND/, 'status must report that no source was found');
  dom.window.close();
}

// Requirement: Resolution is local state, not a new recording
{
  const { dom, window, loaded, drain, saved } = boot({ search: '9bZkp7q19f0' });
  window.importTracks([{ title: 'Gangnam Style', artist: 'PSY' }]);
  drain();
  await window.playIndex(0);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(loaded, ['9bZkp7q19f0'], 'a matched unresolved track must play the found source');
  const rows = saved();
  assert.equal(rows.length, 1, 'resolution must not create a second recording');
  assert.equal(rows[0].id, '9bZkp7q19f0', 'the found id must be persisted');
  assert.equal(rows[0].title, 'Gangnam Style', 'resolution must not overwrite preserved metadata');
  dom.window.close();
}

{
  const { dom, window, saved } = boot();
  window.importTracks([{ title: 'Teardrop', artist: 'Massive Attack' }]);
  const again = window.importTracks([{ id: 'dQw4w9WgXcQ', title: 'Teardrop', artist: 'Massive Attack' }]);
  const rows = saved();
  assert.equal(rows.length, 1, 're-importing the same recording with a handle must not duplicate it');
  assert.equal(rows[0].id, 'dQw4w9WgXcQ', 'the existing recording must adopt the playable handle');
  assert.equal(again.total, 1);
  dom.window.close();
}

{
  const { dom, window, saved } = boot();
  window.importTracks([{ title: 'Teardrop', artist: 'Massive Attack' }]);
  const again = window.importTracks([{ title: 'Teardrop', artist: 'Massive Attack' }]);
  assert.equal(again.added, 0, 'importing an identical unresolved recording must add nothing');
  assert.equal(saved().length, 1);
  dom.window.close();
}

// Requirement: A malformed provider identifier is discarded, not the recording
{
  const { dom, window, saved } = boot();
  const result = window.importTracks([{ id: 'not-11', title: 'Bad', artist: 'Bad' }]);
  assert.equal(result.added, 1, 'a malformed provider id must not destroy the recording');
  const [track] = saved();
  assert.notEqual(track.id, 'not-11', 'a malformed provider id must not be stored');
  assert.ok(!VIDEO_ID_RE.test(track.id), 'the stored id must not be a valid YouTube id');
  assert.equal(track.title, 'Bad');
  dom.window.close();
}

// Shared resolution definition
{
  const { dom, window } = boot();
  assert.equal(typeof window.ampMusicIsResolved, 'function', 'the resolved test must be shared with adapters');
  assert.equal(window.ampMusicIsResolved({ id: 'dQw4w9WgXcQ' }), true);
  assert.equal(window.ampMusicIsResolved({ id: 'not-11' }), false);
  assert.equal(window.ampMusicIsResolved({}), false);
  dom.window.close();
}

// Requirement: Stored identity is never manufactured from a provider handle
// End-to-end: what the core persists is what Ámpula Core v1 receives.
{
  const { dom, window, saved } = boot();
  window.importTracks([
    { id: 'dQw4w9WgXcQ' },
    { title: 'Teardrop', artist: 'Massive Attack' },
  ]);
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  const dialogProto = window.HTMLDialogElement?.prototype;
  if (dialogProto && typeof dialogProto.showModal !== 'function') {
    dialogProto.showModal = function showModal() { this.setAttribute('open', ''); };
    dialogProto.close = function close() { this.removeAttribute('open'); };
  }
  window.eval(fs.readFileSync('compact-share.js', 'utf8'));
  const ampula = window.winampMusicCompactShare.toAmpula(saved());
  assert.equal(ampula.tracks.length, 2, 'an unresolved track must still be shared');

  const [noMetadata, unresolved] = ampula.tracks;
  assert.ok(!noMetadata.title.includes('dQw4w9WgXcQ'), 'a provider handle must not become the Core v1 title');
  assert.ok(!noMetadata.artists.some((name) => String(name).includes('dQw4w9WgXcQ')), 'a provider handle must not become a Core v1 artist');
  assert.notEqual(noMetadata.artists[0], 'YouTube', 'a provider name must not become a Core v1 artist');
  assert.ok(noMetadata.observations.some((obs) => obs.service === 'youtube' && obs.itemId === 'dQw4w9WgXcQ'), 'the provider handle must survive as an observation');

  assert.equal(unresolved.title, 'Teardrop', 'an unresolved track keeps its real identity');
  assert.deepEqual(Array.from(unresolved.artists), ['Massive Attack']);
  const observations = Array.from(unresolved.observations || []);
  assert.deepEqual(observations, [], 'a local identifier must never be published as an observation');
  dom.window.close();
}

console.log('Ámpula unresolved-tracks-v1 domain test passed');
process.exit(0);
