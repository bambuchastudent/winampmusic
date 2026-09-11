import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const queueSource = readFileSync(new URL('../playback-queue-v170.js', import.meta.url), 'utf8');
const fastSource = readFileSync(new URL('../fast-player-v141.js', import.meta.url), 'utf8');
const FINAL = 'music-only-v1.6.7';
const KEY = 'winampmusic.library.v1';
const CURRENT = 'winampmusic.fast.current.v1';

assert.match(fastSource, /PlayerState\?\.ENDED[\s\S]*?playRelative\(1\)/, 'YouTube ENDED must use the same next navigation path');
assert.match(fastSource, /ui\.next\.addEventListener\('click', \(\) => playRelative\(1\)\)/, 'Next button must use next navigation');

function ready(id, title, spotifyTrackId) {
  return { id, title, artist: 'Artist', spotifyTrackId, badges: ['Spotify', 'Origin'], youtubeMatchFinalTrustVersion: FINAL };
}
function unresolved(title, spotifyTrackId) {
  return { id: `U-${spotifyTrackId}`, title, artist: 'Artist', spotifyTrackId, badges: ['Spotify', 'Origin'] };
}
function makeDom(rows, currentIndex, resolveAll) {
  const dom = new JSDOM('<!doctype html><body><div id="status">PLAYING</div><button id="playButton">⏸</button></body>', {
    url: 'https://bambuchastudent.github.io/winampmusic/',
    runScripts: 'outside-only',
  });
  const { window } = dom;
  window.localStorage.setItem(KEY, JSON.stringify(rows));
  window.localStorage.setItem(CURRENT, String(currentIndex));
  const calls = [];
  window.playIndex = async (index) => {
    calls.push(index);
    window.localStorage.setItem(CURRENT, String(index));
    return `played:${index}`;
  };
  window.renderLibrary = () => {};
  window.ampMusicOriginPlayback151 = { refresh() {} };
  window.importTracks = () => ({ added: 0, total: rows.length });
  window.ampulaPlaybackPrefetch165 = {
    resolveAhead: async () => null,
    resolveAll,
  };
  window.ampulaTrackDiagnostics164 = { resolveTrusted: async () => null };
  window.eval(queueSource);
  return { dom, window, calls };
}

{
  const rows = [
    ready('aaaaaaaaaaa', '40 Current', 's40'),
    unresolved('41 Missing', 's41'),
    unresolved('42 Resolving', 's42'),
  ];
  let scheduled = false;
  let windowRef;
  const resolveAll = async () => {
    if (scheduled) return [];
    scheduled = true;
    setTimeout(() => {
      const latest = JSON.parse(windowRef.localStorage.getItem(KEY));
      latest[2] = ready('bbbbbbbbbbb', '42 Resolving', 's42');
      windowRef.localStorage.setItem(KEY, JSON.stringify(latest));
    }, 30);
    return [];
  };
  const ctx = makeDom(rows, 0, resolveAll);
  windowRef = ctx.window;
  const result = await ctx.window.playIndex(1);
  assert.equal(result, 'played:2', 'Next/ENDED must wait for later playable 42 instead of replaying current 40');
  assert.deepEqual(ctx.calls, [2], 'current row must be excluded from unresolved recovery');
  assert.equal(JSON.parse(ctx.window.localStorage.getItem(KEY))[1].title, '41 Missing', 'skipped unresolved row stays in the library');
  ctx.dom.window.close();
}

{
  const rows = [
    ready('aaaaaaaaaaa', 'Earlier Ready', 's0'),
    unresolved('Previous Missing', 's1'),
    ready('bbbbbbbbbbb', 'Current', 's2'),
    ready('ccccccccccc', 'Forward Ready', 's3'),
  ];
  const ctx = makeDom(rows, 2, async () => []);
  const result = await ctx.window.playIndex(1);
  assert.equal(result, 'played:0', 'Previous navigation over an unresolved row must keep backward direction');
  assert.deepEqual(ctx.calls, [0]);
  ctx.dom.window.close();
}

console.log('skip unresolved playback v1.7.6: ok');
