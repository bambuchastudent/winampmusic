import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../origin-playback-v151.js', import.meta.url), 'utf8');
const dom = new JSDOM(`<!doctype html><body>
  <div id="status">PLAYING</div>
  <div><div id="nowTitle">Better Call Saul Main Title</div><div id="nowArtist">Dave Porter</div></div>
  <div id="fastImportHint"></div>
  <form id="fastImportForm"><input id="fastImportInput"></form>
</body>`, { url: 'https://bambuchastudent.github.io/winampmusic/', runScripts: 'outside-only' });
const { window } = dom;

window.localStorage.setItem('winampmusic.library.v1', JSON.stringify([{
  id: 'abcdefghijk',
  title: 'Better Call Saul Main Title',
  artist: 'Dave Porter',
  spotifyTrackId: '4cOdK2wGLETKBW3PvgPWqT',
  spotifyTrackUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
  spotifyPlaylistId: '3A4l0emm89zzee5bzE7E0L',
  spotifyPlaylistUrl: 'https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L',
  youtubeMatchId: 'abcdefghijk',
  playbackProvider: 'youtube',
  badges: ['Spotify', 'Origin', 'YouTube match'],
}]));
window.localStorage.setItem('winampmusic.fast.current.v1', '0');

window.eval(source);
window.ampMusicOriginPlayback151.refresh();
const line = window.document.getElementById('nowSource');
assert.ok(line && !line.hidden, 'Spotify-origin track must show provenance');
assert.equal(line.textContent, 'Origin · Spotify · Playing · YouTube');
assert.equal(line.dataset.originUrl, 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
assert.equal(line.dataset.originPlaylistUrl, 'https://open.spotify.com/playlist/3A4l0emm89zzee5bzE7E0L');

window.document.getElementById('status').textContent = 'REPAIRING YOUTUBE ID…';
window.ampMusicOriginPlayback151.refresh();
assert.equal(line.textContent, 'Origin · Spotify · Resolving · YouTube');

console.log('spotify origin/playback provenance contract: ok');
dom.window.close();
