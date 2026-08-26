import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TextDecoder, TextEncoder } from 'node:util';
import { JSDOM } from 'jsdom';

// Encodes openspec/changes/telegram-text-import-v1/specs/telegram-text-import/spec.md

const ADAPTER_FILE = 'telegram-text-import-v1.js';
assert.ok(fs.existsSync(ADAPTER_FILE), `${ADAPTER_FILE} must exist as a lazy text import adapter`);

const core = fs.readFileSync('fast-player-v141.js', 'utf8');
const adapter = fs.readFileSync(ADAPTER_FILE, 'utf8');
const router = fs.readFileSync('fast-import-v150.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const html = index
  .replace('<script src="./fast-player-v141.js?v=150"></script>', '')
  .replace('<script src="./fast-release-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-import-v150.js?v=150" defer></script>', '')
  .replace('<script src="./stable-v150.js?v=150" defer></script>', '')
  .replace('<script src="./fast-actions-v143.js?v=161" defer></script>', '');

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function boot({ stored = [], withRouter = false } = {}) {
  const dom = new JSDOM(html, {
    runScripts: 'outside-only',
    url: 'https://example.test/winampmusic/',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.console = console;
  const idle = [];
  window.requestIdleCallback = (callback) => { idle.push(callback); return idle.length; };
  window.cancelIdleCallback = () => {};
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(stored));

  const fetched = [];
  window.fetch = async (url) => {
    fetched.push(String(url));
    return { ok: false, status: 404, json: async () => [], text: async () => '' };
  };
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

  window.eval(core);
  const played = [];
  const corePlayIndex = window.playIndex;
  window.playIndex = (position) => { played.push(position); return corePlayIndex(position); };
  window.eval(adapter);
  if (withRouter) {
    for (const marker of ['apple-track-import', 'apple-playlist-import', 'telegram-text-import']) {
      const script = window.document.createElement('script');
      script.dataset.ampModule = marker;
      script.dataset.loaded = '1';
      window.document.head.appendChild(script);
    }
    window.eval(router);
  }

  const drain = () => { while (idle.length) idle.shift()({ didTimeout: false, timeRemaining: () => 50 }); };
  const saved = () => JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  const text = (id) => String(window.document.getElementById(id)?.textContent || '').trim();
  const telegram = () => window.ampMusicTelegramText1;
  return { dom, window, fetched, loaded, played, drain, saved, text, telegram };
}

const identity = (rows) => rows.map((track) => `${track.artist} — ${track.title}`);

// Requirement: A pasted line becomes a recording
{
  const { dom, window, saved, telegram } = boot();
  const result = telegram().importText('Massive Attack — Teardrop');
  assert.equal(result.added, 1, 'a single Artist — Title line must be imported');
  assert.deepEqual(identity(saved()), ['Massive Attack — Teardrop']);
  assert.equal(window.document.getElementById('trackCount').textContent, '1');
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText([
    'Massive Attack — Teardrop',
    'The xx - Intro',
    'Portishead – Roads',
  ].join('\n'));
  assert.deepEqual(identity(saved()), [
    'Massive Attack — Teardrop',
    'The xx — Intro',
    'Portishead — Roads',
  ], 'em dash, hyphen and en dash must all be accepted');
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText('Артист — Название песни');
  assert.deepEqual(identity(saved()), ['Артист — Название песни'], 'non-Latin text must be imported unchanged');
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText('   Massive Attack    —    Teardrop   ');
  const [track] = saved();
  assert.equal(track.artist, 'Massive Attack', 'spacing around the separator must not leak into the artist');
  assert.equal(track.title, 'Teardrop', 'spacing around the separator must not leak into the title');
  dom.window.close();
}

// Requirement: A pasted line becomes a recording — order is preserved
{
  const { dom, saved, telegram } = boot();
  const result = telegram().importText([
    'Massive Attack — Teardrop',
    'The xx - Intro',
    'Portishead – Roads',
    'Артист — Название песни',
  ].join('\n'));
  assert.equal(result.tracks, 4);
  assert.deepEqual(identity(saved()), [
    'Massive Attack — Teardrop',
    'The xx — Intro',
    'Portishead — Roads',
    'Артист — Название песни',
  ], 'the pasted order must be the library order');
  dom.window.close();
}

// Requirement: An obvious chat prefix is removed
{
  const { dom, saved, telegram } = boot();
  telegram().importText('13:42 Dmitry: Massive Attack — Teardrop');
  const [track] = saved();
  assert.equal(track.artist, 'Massive Attack', 'a Telegram time/name prefix must not become the artist');
  assert.equal(track.title, 'Teardrop');
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText([
    '[09:05] Аня: Portishead – Roads',
    'Dmitry: The xx - Intro',
  ].join('\n'));
  assert.deepEqual(identity(saved()), ['Portishead — Roads', 'The xx — Intro']);
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText('Nine Inch Nails — Something I Can Never Have: live');
  const [track] = saved();
  assert.equal(track.artist, 'Nine Inch Nails', 'a colon inside a title must not look like a chat author');
  assert.equal(track.title, 'Something I Can Never Have: live');
  dom.window.close();
}

// Requirement: The parser is conservative
{
  const { dom, saved, telegram } = boot();
  const result = telegram().importText([
    'привет, как дела',
    '',
    'Massive Attack — Teardrop',
    '👍',
    'let\'s listen to this tonight',
    'The xx - Intro',
  ].join('\n'));
  assert.equal(result.tracks, 2, 'only recognised lines may be imported');
  assert.deepEqual(identity(saved()), ['Massive Attack — Teardrop', 'The xx — Intro']);
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  const result = telegram().importText([
    'https://music.apple.com/tr/song/teardrop/1850810463',
    'https://youtu.be/dQw4w9WgXcQ',
    'www.youtube.com/watch?v=dQw4w9WgXcQ',
  ].join('\n'));
  assert.equal(result.added, 0, 'a URL on its own is not a recording');
  assert.deepEqual(saved(), []);
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText('Massive Attack — https://youtu.be/dQw4w9WgXcQ');
  assert.deepEqual(saved(), [], 'a URL on either side of the separator is not a title');
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText(['— Teardrop', 'Massive Attack —', '   -   ', '–'].join('\n'));
  assert.deepEqual(saved(), [], 'an empty artist or title is not a recording');
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText(['Jay-Z', 'Anne-Marie', 'Twenty-One Pilots'].join('\n'));
  assert.deepEqual(saved(), [], 'a hyphen inside a word must not be read as a separator');
  dom.window.close();
}

{
  const { dom, saved, text, telegram } = boot();
  const result = telegram().importText(['привет', 'ну что', 'Jay-Z'].join('\n'));
  assert.equal(result.tracks, 0);
  assert.equal(result.added, 0);
  assert.deepEqual(saved(), []);
  assert.match(result.message, /no Artist — Title lines found/, 'nothing recognised must be reported plainly');
  assert.doesNotMatch(result.message, /Could not|failed|error/i, 'nothing recognised is not an import failure');
  assert.match(text('textImportHint'), /no Artist — Title lines found/);
  dom.window.close();
}

{
  const { dom, telegram } = boot();
  for (const value of [undefined, null, '', '   ', 0, {}, []]) {
    const result = telegram().importText(value);
    assert.equal(result.added, 0, 'unusable input must not raise');
    assert.equal(result.tracks, 0);
  }
  dom.window.close();
}

// Requirement: The import produces unresolved recordings
{
  const { dom, window, drain, saved, telegram } = boot();
  telegram().importText('Massive Attack — Teardrop');
  drain();
  const [track] = saved();
  assert.ok(track.id, 'the library must assign a local recording identifier');
  assert.ok(!VIDEO_ID_RE.test(track.id), `${track.id} must not look like a YouTube id`);
  assert.equal(window.ampMusicVideoIdFromValue(track.id), '', 'provider normalization must reject the local identifier');
  assert.equal(window.ampMusicIsResolved(track), false, 'a text import must land as unresolved');
  const rows = Array.from(window.document.querySelectorAll('.track'));
  assert.equal(rows.length, 1, 'the unresolved recording must be listed');
  assert.ok(rows[0].classList.contains('unresolved'), 'the row must be marked unresolved');
  assert.equal(window.document.getElementById('trackCount').textContent, '1');
  dom.window.close();
}

{
  const { dom, window, fetched, loaded, played, saved, text, telegram } = boot();
  telegram().importText([
    'Massive Attack — Teardrop',
    'The xx - Intro',
    'Portishead – Roads',
  ].join('\n'));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(fetched, [], 'the import must not search for a playable source');
  assert.deepEqual(loaded, [], 'the import must not reach provider playback');
  assert.deepEqual(played, [], 'the import must not start playback');
  assert.doesNotMatch(text('status'), /STARTING|LOADING/, 'the import must not put the player into a playback state');
  for (const track of saved()) {
    assert.ok(!VIDEO_ID_RE.test(track.id), 'the adapter must not assign a provider identifier');
    assert.equal(track.videoId, undefined);
  }
  assert.equal(window.document.querySelectorAll('.track.unresolved').length, 3);
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText('Massive Attack — Teardrop');
  const [track] = saved();
  assert.deepEqual(Array.from(track.badges || []), ['Telegram', 'Text import'], 'provenance must be kept as local badges');
  assert.equal(track.sourceLine, 'Massive Attack — Teardrop', 'the original line may be kept as local metadata');
  assert.equal(track.title, 'Teardrop', 'provenance must not be stored as identity');
  assert.equal(track.artist, 'Massive Attack');
  assert.ok(track.importedAt, 'the import time must be recorded');
  assert.equal(track.sourceUrl, undefined, 'a pasted line is not a provider URL');
  assert.equal(track.url, undefined);
  assert.equal(track.originUrl, undefined);
  assert.equal(track.appleTrackUrl, undefined);
  dom.window.close();
}

// Requirement: Identity is the library's, not the adapter's
{
  const { dom, saved, telegram } = boot();
  telegram().importText('Massive Attack — Teardrop');
  const again = telegram().importText('Massive Attack — Teardrop');
  assert.equal(again.added, 0, 'a repeated text import must not duplicate a recording');
  assert.equal(again.existing, 1, 'the status must count it as already saved');
  assert.equal(saved().length, 1);
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText('Massive Attack — Teardrop');
  const again = telegram().importText('massive attack —   teardrop');
  assert.equal(again.added, 0, 'identity must ignore capitalization and spacing');
  assert.equal(saved().length, 1);
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot({
    stored: [{ id: 'dQw4w9WgXcQ', title: 'Teardrop', artist: 'Massive Attack', badges: ['YouTube'] }],
  });
  const result = telegram().importText('Massive Attack — Teardrop');
  const rows = saved();
  assert.equal(result.added, 0, 'a text import must not duplicate an already resolved recording');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'dQw4w9WgXcQ', 'the playable handle already in use must be kept');
  dom.window.close();
}

{
  const { dom, window, saved, telegram } = boot();
  telegram().importText('Massive Attack — Teardrop');
  window.importTracks([{ id: 'dQw4w9WgXcQ', title: 'Teardrop', artist: 'Massive Attack' }]);
  const rows = saved();
  assert.equal(rows.length, 1, 'a later playable handle must land on the same recording');
  assert.equal(rows[0].id, 'dQw4w9WgXcQ', 'the text-imported recording must become playable');
  assert.equal(rows[0].title, 'Teardrop');
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  telegram().importText(['Massive Attack — Teardrop', 'Newton Faulkner — Teardrop'].join('\n'));
  assert.deepEqual(identity(saved()), ['Massive Attack — Teardrop', 'Newton Faulkner — Teardrop'],
    'the same title by a different artist is a different recording');
  dom.window.close();
}

{
  const { dom, saved, telegram } = boot();
  const result = telegram().importText([
    'Massive Attack — Teardrop',
    'massive attack - teardrop',
  ].join('\n'));
  assert.equal(result.tracks, 1, 'one recording repeated in one paste is one recording');
  assert.equal(result.added, 1);
  assert.equal(saved().length, 1);
  dom.window.close();
}

// Requirement: The import reports what happened
{
  const { dom, text, telegram } = boot({
    stored: [
      { id: 'dQw4w9WgXcQ', title: 'Teardrop', artist: 'Massive Attack' },
      { id: 'aaaaaaaaaaa', title: 'Intro', artist: 'The xx' },
    ],
  });
  const result = telegram().importText([
    '13:42 Dmitry: Massive Attack — Teardrop',
    'The xx - Intro',
    'Portishead – Roads',
    'Артист — Название песни',
    'https://youtu.be/dQw4w9WgXcQ',
    'привет, как дела',
    'Radiohead — Karma Police',
    'Massive Attack — Teardrop',
    'Björk — Jóga',
    'Aphex Twin — Xtal',
    'Boards of Canada — Roygbiv',
    'Jay-Z',
  ].join('\n'));
  assert.equal(result.lines, 12);
  assert.equal(result.tracks, 8);
  assert.equal(result.added, 6);
  assert.equal(result.existing, 2);
  assert.equal(result.message, '12 lines · 8 tracks · 6 new · 2 already saved');
  assert.equal(text('textImportHint'), '12 lines · 8 tracks · 6 new · 2 already saved');
  dom.window.close();
}

{
  const { dom, telegram } = boot();
  const result = telegram().importText(['Massive Attack — Teardrop', 'The xx - Intro'].join('\n'));
  assert.equal(result.message, '2 lines · 2 tracks · 2 new');
  assert.doesNotMatch(result.message, /already saved/, 'a fully new import must not mention already saved tracks');
  dom.window.close();
}

// Requirement: One paste is bounded
{
  const { dom, saved, telegram } = boot();
  const many = Array.from({ length: 400 }, (_, position) => `Artist ${position} — Song ${position}`).join('\n');
  const started = Date.now();
  const result = telegram().importText(many);
  const elapsed = Date.now() - started;
  assert.equal(result.lines, 400);
  assert.equal(result.tracks, 300, 'one import must be bounded');
  assert.equal(result.added, 300);
  assert.equal(result.skipped, 100);
  assert.match(result.message, /100 over the 300 track limit/, 'the remainder must be reported');
  const rows = saved();
  assert.equal(rows.length, 300);
  assert.equal(rows[0].title, 'Song 0', 'the kept recordings must be the first in the pasted order');
  assert.equal(rows.at(-1).title, 'Song 299');
  assert.ok(elapsed < 3000, `an oversized paste must not block the main thread (${elapsed} ms)`);
  dom.window.close();
}

// Requirement: Pasted text is not an Ámpula provider
{
  const { dom, window, saved, telegram } = boot();
  telegram().importText(['Massive Attack — Teardrop', 'The xx - Intro'].join('\n'));
  window.TextEncoder = TextEncoder;
  window.TextDecoder = TextDecoder;
  const dialogProto = window.HTMLDialogElement?.prototype;
  if (dialogProto && typeof dialogProto.showModal !== 'function') {
    dialogProto.showModal = function showModal() { this.setAttribute('open', ''); };
    dialogProto.close = function close() { this.removeAttribute('open'); };
  }
  window.eval(fs.readFileSync('compact-share.js', 'utf8'));
  const rows = saved();
  const ampula = window.winampMusicCompactShare.toAmpula(rows);
  assert.equal(ampula.tracks.length, 2);
  assert.equal(ampula.tracks[0].title, 'Teardrop');
  assert.deepEqual(Array.from(ampula.tracks[0].artists), ['Massive Attack']);
  for (const [position, track] of ampula.tracks.entries()) {
    const observations = Array.from(track.observations || []);
    assert.deepEqual(observations, [], 'a text import must publish no provider observation');
    assert.ok(!JSON.stringify(track).includes(rows[position].id), 'the local recording id must never be published');
    assert.ok(!JSON.stringify(track).toLowerCase().includes('telegram'), 'Telegram must not become an Ámpula provider');
  }
  dom.window.close();
}

// Requirement: Text import belongs to the unified entry
{
  const { dom, window, telegram } = boot({ withRouter: true });
  assert.ok(telegram(), 'the adapter must expose its API');
  const input = window.document.getElementById('fastImportInput');
  const pasted = ['Massive Attack — Teardrop', 'The xx - Intro', 'Portishead – Roads'].join('\n');
  const event = new window.Event('paste', { bubbles: true, cancelable: true });
  event.clipboardData = { getData: () => pasted };
  input.dispatchEvent(event);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(event.defaultPrevented, true, 'a multi-line paste must not fall into the single-line input');
  assert.equal(input.value, '', 'the single-line input must not be filled with joined lines');
  const panel = window.document.getElementById('textImportPanel');
  assert.equal(panel.hidden, false, 'the text import panel must open for a multi-line paste');
  assert.equal(window.document.getElementById('textImportInput').value, pasted, 'the pasted text must reach the panel');
  dom.window.close();
}

{
  const { dom, window, saved, text } = boot({ withRouter: true });
  const input = window.document.getElementById('fastImportInput');
  input.value = 'Massive Attack — Teardrop';
  window.document.getElementById('fastImportForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(saved(), [], 'one line of free text must stay a search, not an import');
  assert.match(text('fastImportHint'), /YouTube or Apple Music track\/playlist link/);
  dom.window.close();
}

{
  const { dom, window, saved, text } = boot({ withRouter: true });
  const panel = window.document.getElementById('textImportPanel');
  const toggle = window.document.getElementById('textImportToggle');
  assert.equal(panel.hidden, true, 'the panel must start closed');
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(panel.hidden, false, 'the toggle must open the paste panel');
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');

  window.document.getElementById('textImportInput').value = 'Massive Attack — Teardrop\nThe xx - Intro';
  window.document.getElementById('textImportButton').dispatchEvent(new window.Event('click', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(identity(saved()), ['Massive Attack — Teardrop', 'The xx — Intro'], 'the panel button must import the pasted lines');
  assert.equal(text('textImportHint'), '2 lines · 2 tracks · 2 new');
  dom.window.close();
}

// Requirement: the parser stays out of the synchronous core
assert.ok(!/telegram/i.test(core), 'the synchronous core must not know about Telegram');
assert.ok(!index.includes('telegram-text-import-v1.js'), 'the text import adapter must stay lazy');
assert.match(router, /telegram-text-import-v1\.js/, 'the unified entry must load the adapter on demand');
assert.ok(Buffer.byteLength(core, 'utf8') < 19000, 'this change must not raise the core source budget');
assert.match(index, /id="textImportPanel"/, 'the paste panel must live inside the existing import section');
assert.match(index, /id="textImportToggle"/);

console.log('Ámpula telegram-text-import-v1 behaviour test passed');
process.exit(0);
