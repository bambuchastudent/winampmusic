import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');
const loader = fs.readFileSync('fast-release-v150.js', 'utf8');

function boot(search = '') {
  const status = { textContent: 'READY' };
  let audioPlayCalls = 0;

  class AudioStub {
    constructor() {
      this.paused = true;
      this.volume = 1;
      this.currentTime = 0;
      this.duration = Number.NaN;
    }
    addEventListener() {}
    play() { audioPlayCalls += 1; this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    removeAttribute() {}
  }

  const originalPlayIndex = () => 'iframe';
  const window = {
    AMPULA_YOUTUBEJS_RELAY: '',
    location: { search },
    playIndex: originalPlayIndex,
    addEventListener() {},
  };
  window.window = window;

  const context = {
    window,
    document: {
      readyState: 'complete',
      activeElement: null,
      getElementById: (id) => (id === 'status' ? status : null),
      querySelectorAll: () => [],
    },
    navigator: {},
    localStorage: { getItem: () => null, setItem() {} },
    Audio: AudioStub,
    URL,
    URLSearchParams,
    Request,
    Response,
    Headers,
    Blob,
    ArrayBuffer,
    DataView,
    Uint8Array,
    Number,
    String,
    Promise,
    console,
    setTimeout,
    clearTimeout,
  };

  vm.createContext(context);
  vm.runInContext(source, context);
  return { window, status, originalPlayIndex, audioPlayCalls: () => audioPlayCalls };
}

const normal = boot();
assert.equal(normal.window.playIndex, normal.originalPlayIndex, 'missing relay must preserve iframe playback');
assert.equal(normal.audioPlayCalls(), 0, 'missing relay must not prime native audio');

const diagnostic = boot('?playback=youtubejs');
assert.equal(diagnostic.window.playIndex, diagnostic.originalPlayIndex, 'diagnostic mode must not install an unusable override');
assert.equal(diagnostic.status.textContent, 'YOUTUBEJS ERROR · RELAY NOT CONFIGURED');

assert.match(source, /AMPULA_YOUTUBEJS_RELAY/);
assert.match(source, /RELAY NOT CONFIGURED/);
assert.match(loader, /youtubejs-audio-first-v181\.js\?v=187/);

console.log('YouTube.js relay availability v1.8.7 contract OK');
