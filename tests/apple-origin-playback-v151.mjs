import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const appleUrl = 'https://music.apple.com/tr/album/amulet/1445697454?i=1445697457';
const dom = new JSDOM(`<!doctype html><body>
  <form id="fastImportForm"><input id="fastImportInput"><button>go</button></form>
  <div id="fastImportHint">Apple Music track added · playing YouTube match</div>
  <div id="status">APPLE MUSIC MATCHED</div>
  <div id="nowTitle">Amulet</div>
  <div id="nowArtist">Ext</div>
</body>`, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});

const { window } = dom;
window.console = console;
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{
  id: 'abcdefghijk',
  title: 'Amulet',
  artist: 'Ext',
  sourceUrl: appleUrl,
  appleTrackId: '1445697457',
  badges: ['Apple Music', 'Strict match'],
}]));
window.localStorage.setItem('winampmusic.fast.current.v1', '0');

window.eval(fs.readFileSync('origin-playback-v151.js', 'utf8'));
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
await tick();

const api = window.ampMusicOriginPlayback151;
assert.ok(api, 'provenance bridge is exposed');
assert.equal(api.parseAppleUrl(appleUrl)?.storefront, 'TR');
assert.equal(api.parseAppleUrl('https://www.youtube.com/watch?v=abcdefghijk'), null);

const source = window.document.getElementById('nowSource');
assert.ok(source, 'player gets a dedicated provenance line');
assert.match(source.textContent, /Origin · Apple Music \(TR\)/);
assert.match(source.textContent, /Playback · YouTube candidate/);
assert.equal(source.dataset.originUrl, appleUrl);
assert.equal(
  window.document.getElementById('fastImportHint').textContent,
  'Apple Music (TR) origin preserved · YouTube match found · playback not verified',
  'matching must not be reported as playback',
);

window.document.getElementById('status').textContent = 'YOUTUBE DIRECT · PLAYING';
await tick();
assert.match(source.textContent, /Playing · YouTube/);
assert.equal(
  window.document.getElementById('fastImportHint').textContent,
  'Apple Music (TR) origin preserved · playing from YouTube',
);

window.document.getElementById('status').textContent = 'TRACK UNAVAILABLE · STAYING IN AMP MUSIC';
await tick();
assert.equal(
  window.document.getElementById('status').textContent,
  'NO PLAYABLE SOURCE IN AMP · APPLE ORIGIN PRESERVED',
);
assert.match(source.textContent, /No playable source in AMP/);
assert.match(source.textContent, /Apple Music \(TR\)/, 'origin remains visible after playback failure');
assert.equal(
  window.document.getElementById('fastImportHint').textContent,
  'Apple Music (TR) origin preserved · no playable source in AMP',
);

const stable = fs.readFileSync('stable-v150.js', 'utf8');
assert.match(stable, /origin-playback-v151\.js\?v=151/);

console.log('Apple origin vs playback provenance v1.5.1: OK');
