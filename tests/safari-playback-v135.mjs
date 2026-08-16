import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('index.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const boot = fs.readFileSync('boot-v134.js', 'utf8');
const stripped = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');

const dom = new JSDOM(stripped, {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;

window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
Object.defineProperty(window.navigator, 'mediaSession', {
  configurable: true,
  value: {
    set metadata(_) { throw new Error('Safari partial Media Session'); },
    setActionHandler() {},
    setPositionState() {},
    playbackState: 'none',
  },
});
try { delete window.MediaMetadata; } catch {}

window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([
  { id: 'abcdefghijk', title: 'Safari Track One', artist: 'Artist One' },
  { id: 'lmnopqrstuv', title: 'Safari Track Two', artist: 'Artist Two' },
]));

window.eval(app);
window.eval(boot);

const play = window.document.getElementById('playButton');
const next = window.document.getElementById('nextButton');
const status = window.document.getElementById('status');
const title = window.document.getElementById('nowTitle');

play.click();
assert.equal(status.textContent, 'PLAYER LOADING', 'Play must survive partial Safari Media Session support');
assert.equal(title.textContent, 'Safari Track One', 'Play must select track one');

next.click();
assert.equal(status.textContent, 'PLAYER LOADING', 'Next must remain interactive while YouTube initializes');
assert.equal(title.textContent, 'Safari Track Two', 'Next must select track two');

assert.equal(window.localStorage.getItem('winampmusic.player.v1')?.includes('lmnopqrstuv'), true, 'Player state must be saved after the click');
assert.ok(fs.readFileSync('sw-v135.js', 'utf8').includes('networkFirst'), 'v1.3.5 service worker must prefer fresh app code');
assert.ok(fs.readFileSync('recover.html', 'utf8').includes('winampmusic-shell-'), 'recovery page must clear only app caches');

console.log('v1.3.5 Safari playback recovery: passed');
// boot-v134 intentionally leaves a YouTube-loader timer alive. Ending this
// dedicated smoke process after all assertions avoids jsdom tearing down the
// document while that browser-like microtask is still pending.
process.exit(0);
