import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const source = fs.readFileSync('youtubejs-audio-first-v181.js', 'utf8');
const dom = new JSDOM(`<!doctype html><html><body><section class="screen">
  <div id="status">READY</div><div id="nowTitle">The Reflex</div><div id="nowArtist">Duran Duran</div>
  <div id="nowSource">Origin · Spotify · Playback · YouTube</div>
  <div class="time-row"></div></section><button id="playButton">▶</button></body></html>`, {
  url: 'https://example.test/winampmusic/', runScripts: 'outside-only', pretendToBeVisual: true,
});
const { window } = dom;
class AudioStub {
  addEventListener() {}
  play() { return Promise.resolve(); }
  pause() {}
  load() {}
  removeAttribute() {}
}
window.Audio = AudioStub;
window.AMPULA_YOUTUBEJS_RELAY = 'https://relay.example/';
window.playIndex = () => 'iframe';
window.eval(source);
const adapter = window.ampulaYouTubeJsAudio181;
assert.ok(adapter, 'YouTube.js adapter is installed');
const url = 'https://googlevideo.com/videoplayback?pot=SECRET_TOKEN&expire=123';
const calls = [];
const retry = {
  async getStreamingData(_id, options) {
    calls.push(options.client || 'WEB');
    if (options.client === 'YTMUSIC') return { url, mimeType: 'audio/mp4', bitrate: 128000 };
    throw new Error('Streaming data not available');
  },
  async getBasicInfo() { return { playability_status: { status: 'OK' }, streaming_data: { adaptive_formats: [], formats: [] } }; },
};
const resolved = await adapter.resolveAudio('J5ebkj9x5Ko', retry);
assert.equal(resolved.url, url);
assert.deepEqual(calls, ['WEB', 'YTMUSIC']);
assert.equal(adapter.diagnostics()?.attempts?.[0]?.audioFormats, 0);

const deniedCalls = [];
const denied = {
  async getStreamingData(_id, options) { deniedCalls.push(options.client || 'WEB'); throw new Error('Streaming data not available'); },
  async getBasicInfo() { return { playability_status: { status: 'LOGIN_REQUIRED', reason: `private ${url}` }, streaming_data: null }; },
};
await assert.rejects(adapter.resolveAudio('J5ebkj9x5Ko', denied), /Streaming data not available/);
assert.deepEqual(deniedCalls, ['WEB'], 'explicit denial never triggers an alternate client');
const diag = adapter.diagnostics();
assert.equal(diag.attempts[0].playability, 'LOGIN_REQUIRED');
assert.equal(diag.errorCode, 'STREAM_DATA_UNAVAILABLE');
const details = window.document.getElementById('youtubeJsDiagnostics');
assert.ok(details?.textContent.includes('LOGIN_REQUIRED'), 'diagnostics visible without devtools');
assert.doesNotMatch(JSON.stringify(diag) + details.textContent, /SECRET_TOKEN|googlevideo|private/);
assert.equal(window.document.getElementById('nowTitle').textContent, 'The Reflex');
assert.equal(window.document.getElementById('nowArtist').textContent, 'Duran Duran');
window.URL.createObjectURL = () => 'blob:https://example.test/prime';
window.URL.revokeObjectURL = () => {};
window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{ id: 'J5ebkj9x5Ko', title: 'The Reflex', artist: 'Duran Duran' }]));
assert.equal(await window.playIndex(0, denied), 'iframe', 'denied direct audio preserves playable iframe fallback');
assert.ok(window.document.getElementById('youtubeJsDiagnostics')?.textContent.includes('LOGIN_REQUIRED'));
await window.playIndex(0, retry);
assert.equal(adapter.diagnostics(), null, 'successful native audio clears an earlier failure');
assert.equal(window.document.getElementById('youtubeJsDiagnostics')?.hidden, true);
dom.window.close();
console.log('YouTube.js classified diagnostics and bounded retry v1.8.9 OK');
