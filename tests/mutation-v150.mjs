import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const playerSource = fs.readFileSync('fast-player-v141.js', 'utf8');
const actionsSource = fs.readFileSync('fast-actions-v143.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

function coreHtml() {
  return index
    .replace('<script src="./fast-player-v141.js?v=150"></script>', '')
    .replace('<script src="./fast-release-v150.js?v=150" defer></script>', '')
    .replace('<script src="./fast-import-v150.js?v=150" defer></script>', '')
    .replace('<script src="./fast-actions-v143.js?v=150" defer></script>', '');
}

async function coreContract(source) {
  const dom = new JSDOM(coreHtml(), { runScripts: 'outside-only', url: 'https://example.test/winampmusic/', pretendToBeVisual: true });
  const { window } = dom;
  const idle = [];
  window.requestIdleCallback = (cb) => { idle.push(cb); return idle.length; };
  const tracks = Array.from({ length: 183 }, (_, index) => ({
    id: `vid${String(index).padStart(8, '0')}`,
    title: `Song ${index + 1}`,
    artist: `Artist ${index % 8}`,
  }));
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(tracks));
  let currentId = '';
  let state = 2;
  window.YT = {
    PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2 },
    Player: class {
      constructor(_id, options) { this.options = options; queueMicrotask(() => options.events.onReady?.()); }
      setVolume() {}
      loadVideoById(id) { currentId = id; state = 1; this.options.events.onStateChange?.({ data: 1 }); }
      getPlayerState() { return state; }
      playVideo() { state = 1; this.options.events.onStateChange?.({ data: 1 }); }
      pauseVideo() { state = 2; this.options.events.onStateChange?.({ data: 2 }); }
      getDuration() { return 200; }
      getCurrentTime() { return 2; }
      seekTo() {}
    },
  };
  window.eval(source);
  assert.equal(window.document.querySelectorAll('.track').length, 30, 'startup render batch changed');
  window.document.getElementById('playButton').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(currentId, tracks[0].id, 'Play contract broken');
  window.document.getElementById('nextButton').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(currentId, tracks[1].id, 'Next contract broken');
  window.document.querySelector('.track[data-index="5"] .track-main').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(currentId, tracks[5].id, 'Track click contract broken');
  dom.window.close();
}

async function actionsContract(source) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <div id="status">READY</div><div class="library-header"><div>Playlist</div></div>
  </body></html>`, { runScripts: 'outside-only', url: 'https://example.test/winampmusic/' });
  const { window } = dom;
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'abcdefghijk' }]));
  window.eval(source);
  assert.equal(window.document.querySelector('script[data-fast-module="compact-share"]'), null, 'share became eager');
  const clear = window.document.getElementById('clearPlaylistButton');
  assert.ok(clear, 'Clear action missing');
  clear.click();
  assert.ok(window.localStorage.getItem('winampmusic.library.v1'), 'Clear became one-click destructive');
  dom.window.close();
}

const mutants = [
  {
    name: 'remove Play handler',
    run: () => coreContract(playerSource.replace("ui.play.addEventListener('click', togglePlayback);", "// mutant removed Play handler")),
  },
  {
    name: 'Next repeats current track',
    run: () => coreContract(playerSource.replace("ui.next.addEventListener('click', () => playRelative(1));", "ui.next.addEventListener('click', () => playRelative(0));")),
  },
  {
    name: 'render all 183 synchronously',
    run: () => coreContract(playerSource.replace('const INITIAL_ROWS = 30;', 'const INITIAL_ROWS = 183;')),
  },
  {
    name: 'Clear deletes on first tap',
    run: () => actionsContract(actionsSource.replace('if (now > clearArmedUntil) {', 'if (false) {')),
  },
  {
    name: 'share module loads eagerly',
    run: () => actionsContract(actionsSource.replace("const shareButton = document.createElement('button');", "loadScript('./compact-share.js?v=143', 'compact-share');\n  const shareButton = document.createElement('button');")),
  },
];

let killed = 0;
for (const mutant of mutants) {
  try {
    await mutant.run();
    console.error(`SURVIVED: ${mutant.name}`);
  } catch (error) {
    killed += 1;
    console.log(`KILLED: ${mutant.name} -> ${error.message}`);
  }
}

const score = killed / mutants.length;
console.log(`Mutation score: ${killed}/${mutants.length} (${Math.round(score * 100)}%)`);
assert.equal(killed, mutants.length, 'all critical mutants must be killed before release');
process.exit(0);
