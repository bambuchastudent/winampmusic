import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const code = fs.readFileSync('fast-import-v142.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
assert.match(index, /id="fastImportForm"/);
assert.match(index, /fast-import-v142\.js\?v=143/);
assert.ok(!code.includes('stopImmediatePropagation'));
assert.ok(!code.includes('preventDefault();\n    event.stop'));

const dom = new JSDOM(`<!doctype html><html><body>
  <form id="fastImportForm"><input id="fastImportInput"><button id="fastImportButton" type="submit">Add</button></form>
  <span id="fastImportHint"></span>
</body></html>`, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/' });
const { window } = dom;

const library = [{ id: 'aaaaaaaaaaa', title: 'Existing', artist: 'Test' }];
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(library));
const played = [];
window.importTracks = (items) => {
  const saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1') || '[]');
  let added = 0;
  for (const item of items) {
    if (!saved.some((track) => track.id === item.id)) { saved.push(item); added += 1; }
  }
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(saved));
  return { added, total: saved.length };
};
window.playIndex = (index) => played.push(index);
window.fetch = async () => ({ ok: false });
window.eval(code);

async function submit(value) {
  const input = window.document.getElementById('fastImportInput');
  input.value = value;
  window.document.getElementById('fastImportForm').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

await submit('https://youtu.be/dQw4w9WgXcQ');
let saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(saved.at(-1).id, 'dQw4w9WgXcQ');
assert.equal(played.at(-1), 1);

await submit('https://www.youtube.com/watch?v=9bZkp7q19f0&list=abc');
saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(saved.at(-1).id, '9bZkp7q19f0');
assert.equal(played.at(-1), 2);

await submit('https://youtube.com/shorts/aqz-KE-bpKQ');
saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
assert.equal(saved.at(-1).id, 'aqz-KE-bpKQ');
assert.equal(played.at(-1), 3);

await submit('not a youtube link');
assert.equal(saved.length, 4);
assert.match(window.document.getElementById('fastImportHint').textContent, /Paste a YouTube video link/);

console.log('v1.4.3 fast import test passed');
process.exit(0);
