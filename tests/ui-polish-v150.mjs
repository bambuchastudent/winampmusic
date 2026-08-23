import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const playerSource = fs.readFileSync('fast-player-v141.js', 'utf8');
const importSource = fs.readFileSync('fast-import-v150.js', 'utf8');
const searchSource = fs.readFileSync('v059.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');

assert.match(styles, /\.empty-state\[hidden\]\s*\{\s*display:\s*none/);
assert.ok(!searchSource.includes("version.textContent = 'v0.5.9'"));
assert.ok(!searchSource.includes('installFavicon();'));
assert.match(searchSource, /PIPED_INSTANCES/);
assert.match(searchSource, /filter', 'videos'/);
assert.match(importSource, /window\.updateTrackMetadata/);
assert.match(playerSource, /window\.updateTrackMetadata = updateTrackMetadata/);
assert.match(playerSource, /\.\/v059\.js\?v=150/);

function playerHtml() {
  return `<!doctype html><html><body>
    <div id="status"></div><div id="nowTitle"></div><div id="nowArtist"></div>
    <span id="elapsed"></span><span id="duration"></span>
    <input id="seek" value="0"><input id="volume" value="75">
    <button id="playButton"></button><button id="prevButton"></button><button id="nextButton"></button><button id="shuffleButton"></button>
    <input id="search" value=""><ol id="trackList"></ol><span id="trackCount"></span>
    <div id="emptyState"><strong>No saved music.</strong></div><div id="youtubePlayer"></div>
  </body></html>`;
}

{
  const dom = new JSDOM(playerHtml(), { runScripts: 'outside-only', url: 'https://example.test/winampmusic/' });
  const { window } = dom;
  window.requestIdleCallback = () => 1;
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'D7KW8me9c4A', title: 'YouTube D7KW8me9c4A', artist: 'YouTube' }]));
  window.localStorage.setItem('winampmusic.fast.current.v1', '0');
  window.eval(playerSource);
  assert.equal(window.document.getElementById('emptyState').hidden, true);
  assert.equal(window.document.getElementById('emptyState').style.display, 'none');
  assert.equal(window.updateTrackMetadata('D7KW8me9c4A', { title: 'ГУФ - Дружба', artist: 'ГУФ' }), true);
  const saved = JSON.parse(window.localStorage.getItem('winampmusic.library.v1'));
  assert.equal(saved[0].title, 'ГУФ - Дружба');
  assert.equal(saved[0].artist, 'ГУФ');
  assert.equal(window.document.getElementById('nowTitle').textContent, 'ГУФ - Дружба');
  assert.equal(window.document.querySelector('.track-title').textContent, 'ГУФ - Дружба');
  dom.window.close();
}

{
  const dom = new JSDOM(`<!doctype html><html><body><form id="fastImportForm"><input id="fastImportInput"><button id="fastImportButton"></button></form><span id="fastImportHint"></span></body></html>`, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/' });
  const { window } = dom;
  let patch = null;
  window.updateTrackMetadata = (id, value) => { patch = { id, ...value }; return true; };
  window.fetch = async () => ({ ok: true, json: async () => ({ title: 'ГУФ - Дружба', author_name: 'ГУФ' }) });
  window.eval(importSource);
  assert.equal(await window.ampMusicImport150.upgradeMetadata('D7KW8me9c4A'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(patch)), { id: 'D7KW8me9c4A', title: 'ГУФ - Дружба', artist: 'ГУФ' });
  dom.window.close();
}

{
  const dom = new JSDOM('<!doctype html><html><body><section class="player"></section></body></html>', { runScripts: 'outside-only', url: 'https://example.test/winampmusic/' });
  const { window } = dom;
  window.fetch = async (url) => {
    const text = String(url);
    if (text.includes('/api/v1/search')) throw new Error('Invidious unavailable');
    if (text.includes('/search?')) return { ok: true, json: async () => ({ items: [{ url: '/watch?v=D7KW8me9c4A', title: 'ГУФ - Дружба', uploaderName: 'ГУФ', duration: 218, thumbnail: 'https://i.ytimg.com/example.jpg' }] }) };
    throw new Error(`unexpected ${text}`);
  };
  window.eval(searchSource);
  const items = await window.ampMusicSearch150.searchYouTube('дружба гуф', new window.AbortController().signal);
  assert.equal(items[0].videoId, 'D7KW8me9c4A');
  assert.equal(items[0].title, 'ГУФ - Дружба');
  assert.equal(items[0].author, 'ГУФ');
  dom.window.close();
}

console.log('AmpMusic 1.5 search, metadata and library UI regression test passed');
process.exit(0);
