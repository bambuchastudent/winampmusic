import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('legacy-share-v1.js', 'utf8');
assert.ok(!code.includes("searchParams.set('p'"), 'legacy compatibility code must never generate ?p= links');
assert.ok(!code.includes("searchParams.set('s'"), 'legacy compatibility code must never generate ?s= links');

const dom = new JSDOM('<!doctype html><body><div id="status">READY</div></body>', {
  runScripts: 'outside-only',
  url: 'https://example.test/winampmusic/?p=abcdefghijk.lmnopqrstuv.abcdefghijk',
  pretendToBeVisual: true,
});
const { window } = dom;

let runtimeLibrary = [];
let playedIndex = -1;
window.importTracks = (items) => {
  let added = 0;
  for (const item of Array.isArray(items) ? items : []) {
    if (!item?.id || runtimeLibrary.some((track) => track.id === item.id)) continue;
    runtimeLibrary.push({ ...item, title: item.title || `YouTube ${item.id}`, artist: item.artist || 'YouTube' });
    added += 1;
  }
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(runtimeLibrary));
  return { added, total: runtimeLibrary.length };
};
window.playIndex = (index) => { playedIndex = Number(index); };

window.eval(code);
await new Promise((resolve) => setTimeout(resolve, 10));

assert.ok(window.winampMusicLegacyShare, 'legacy compatibility API must be installed');
assert.deepEqual(runtimeLibrary.map((track) => track.id), ['abcdefghijk', 'lmnopqrstuv'], 'old ?p= IDs must restore in URL order and deduplicate');
assert.equal(playedIndex, 0, 'first restored legacy track should become the start track');
assert.match(window.document.getElementById('status').textContent, /LEGACY SHARE RESTORED/);
assert.ok(!window.document.getElementById('status').textContent.includes('ÁMPULA'), 'provider-only legacy recovery must not be presented as Ámpula');

const beforeMalformed = JSON.stringify(runtimeLibrary);
window.history.replaceState({}, '', '/?p=bad.not-a-youtube-id');
const malformedHandled = await window.winampMusicLegacyShare.load();
assert.equal(malformedHandled, true, 'a legacy URL is handled even when its payload is invalid');
assert.equal(JSON.stringify(runtimeLibrary), beforeMalformed, 'malformed legacy payload must not mutate the working library');
assert.match(window.document.getElementById('status').textContent, /LEGACY SHARE INVALID/);

console.log('legacy self-contained share recovery contract passed');
process.exit(0);
