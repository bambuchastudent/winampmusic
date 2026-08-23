import assert from 'node:assert/strict';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const targetUrl = 'https://music.apple.com/tr/playlist/thexx/pl.u-V9D7mR7TaB8Zkl';
const suppliedUrl = 'https://music.apple.com/tr/playlist/favourite-songs/pl.u-BpUq1XGL0';
const markdown = `Title: ‎thexx by Anastasiia Iangliaeva - Apple Music
URL Source: ${targetUrl}
Markdown Content:
# thexx
Anastasiia Iangliaeva
Preview
Song Artist Album Time
[Intro](https://music.apple.com/tr/song/intro/1850810463)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[xx](https://music.apple.com/tr/album/intro/1850810462)
PREVIEW 2:07
[Infinity](https://music.apple.com/tr/song/infinity/1850810474)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[xx](https://music.apple.com/tr/album/infinity/1850810462)
PREVIEW 5:13
[Crystalised](https://music.apple.com/tr/song/crystalised/1850810470)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[xx](https://music.apple.com/tr/album/crystalised/1850810462)
PREVIEW 3:21
[Islands](https://music.apple.com/tr/song/islands/1850810473)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[xx](https://music.apple.com/tr/album/islands/1850810462)
PREVIEW 2:40
[Angels](https://music.apple.com/tr/song/angels/1440834758)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[The xx](https://music.apple.com/tr/artist/the-xx/315473044)
[Coexist](https://music.apple.com/tr/album/angels/1440834755)
PREVIEW 2:51
`;

const suppliedMarkdown = `Title: ‎Favorite Songs by Anastasiia Iangliaeva

URL Source: ${suppliedUrl}

Markdown Content:
Search
Home
New
Radio
Open in Music
Sign In
PLAY
PLAY
PLAY
Mute
Favorite Songs
Anastasiia Iangliaeva
Updated Tuesday
Preview
\t
Song
\t
Artist
\t
Album
\tTime

\t
Hollow Knight
\t
Christopher Larkin
\t
Hollow Knight (Original Soundtrack)
\t
PREVIEW
1:36


\t
Crystal Peak
\t
Christopher Larkin
\t
Hollow Knight (Original Soundtrack)
\t
PREVIEW
4:08


\t
Когда ты грустишь
\t
Flëur
\t
Волшебство
\t
PREVIEW
3:24
`;

const dom = new JSDOM('<!doctype html><body><input id="input"></body>', {
  url: 'https://bambuchastudent.github.io/winampmusic/',
  runScripts: 'outside-only',
});
const { window } = dom;
window.console = console;

const ids = {
  Intro: 'D7KW8me9c4A',
  Infinity: 'aaaaaaaaaaa',
  Islands: 'bbbbbbbbbbb',
  Angels: 'ccccccccccc',
  'Hollow Knight': 'hhhhhhhhhhh',
  'Crystal Peak': 'iiiiiiiiiii',
  'Когда ты грустишь': 'jjjjjjjjjjj',
};
const matchCalls = [];
window.winampMusicAppleImport = {
  async findYouTubeMatch(meta) {
    matchCalls.push(meta.title);
    if (meta.title === 'Crystalised') throw new Error('simulated unresolved track');
    return { id: ids[meta.title], title: meta.title, artist: meta.artist, duration: Math.round(meta.durationMs / 1000), thumbnail: '' };
  },
};

let fetchedUrl = '';
window.fetch = async (url) => {
  fetchedUrl = String(url);
  return {
    ok: true,
    status: 200,
    text: async () => fetchedUrl.includes('pl.u-BpUq1XGL0') ? suppliedMarkdown : markdown,
  };
};

let imported = [];
window.importTracks = (tracks) => {
  imported = tracks;
  window.localStorage.setItem('winampmusic.library.v1', JSON.stringify(tracks));
  return { added: tracks.length, total: tracks.length };
};
let playedIndex = -1;
window.playIndex = (index) => { playedIndex = index; };

const source = fs.readFileSync('apple-playlist-import-v150.js', 'utf8');
window.eval(source);

const api = window.ampMusicApplePlaylist150;
assert.ok(api, 'Apple playlist importer must expose its API');

const parsed = api.parsePlaylistUrl(targetUrl);
assert.equal(parsed?.storefront, 'tr');
assert.equal(parsed?.playlistId, 'pl.u-V9D7mR7TaB8Zkl');

const extracted = api.parsePlaylistMarkdown(markdown, parsed);
assert.equal(extracted.name, 'thexx');
assert.deepEqual(Array.from(extracted.tracks, (track) => track.title), ['Intro', 'Infinity', 'Crystalised', 'Islands', 'Angels']);
assert.equal(extracted.tracks[0].artist, 'The xx');
assert.equal(extracted.tracks[0].durationMs, 127000);

const suppliedParsed = api.parsePlaylistUrl(suppliedUrl);
assert.equal(suppliedParsed?.storefront, 'tr');
assert.equal(suppliedParsed?.playlistId, 'pl.u-BpUq1XGL0');
const suppliedExtracted = api.parsePlaylistMarkdown(suppliedMarkdown, suppliedParsed);
assert.equal(suppliedExtracted.name, 'Favorite Songs');
assert.deepEqual(Array.from(suppliedExtracted.tracks, (track) => track.title), ['Hollow Knight', 'Crystal Peak', 'Когда ты грустишь']);
assert.deepEqual(Array.from(suppliedExtracted.tracks, (track) => track.artist), ['Christopher Larkin', 'Christopher Larkin', 'Flëur']);
assert.deepEqual(Array.from(suppliedExtracted.tracks, (track) => track.album), ['Hollow Knight (Original Soundtrack)', 'Hollow Knight (Original Soundtrack)', 'Волшебство']);
assert.equal(suppliedExtracted.tracks[0].durationMs, 96000);
assert.equal(suppliedExtracted.tracks[2].durationMs, 204000);

const input = window.document.getElementById('input');
input.value = targetUrl;
const statuses = [];
const result = await api.importPlaylistUrl(targetUrl, {
  input,
  play: true,
  onStatus: (state) => statuses.push(state.message),
});

assert.equal(result.handled, true);
assert.equal(result.playlist.tracks.length, 5);
assert.equal(result.tracks.length, 4, 'one unresolved Apple track must not abort the playlist');
assert.deepEqual(Array.from(imported, (track) => track.title), ['Intro', 'Infinity', 'Islands', 'Angels'], 'successful matches must keep Apple playlist order');
assert.ok(Array.from(imported).every((track) => track.playlist === 'thexx'));
assert.ok(Array.from(imported).every((track) => track.sourceUrl === targetUrl));
assert.ok(Array.from(imported).every((track) => Array.from(track.badges).includes('Apple Music') && Array.from(track.badges).includes('Playlist')));
assert.equal(playedIndex, 0, 'first resolved playlist track should start');
assert.equal(input.value, '');
assert.equal(fetchedUrl, `https://r.jina.ai/${targetUrl}`);
assert.ok(statuses.some((text) => /5 tracks · 4 matched · 4 new/.test(text)));
assert.equal(matchCalls.length, 5);

window.localStorage.removeItem('winampmusic.library.v1');
imported = [];
playedIndex = -1;
input.value = suppliedUrl;
const suppliedStatuses = [];
const suppliedResult = await api.importPlaylistUrl(suppliedUrl, {
  input,
  play: true,
  onStatus: (state) => suppliedStatuses.push(state.message),
});
assert.equal(suppliedResult.handled, true);
assert.equal(suppliedResult.playlist.name, 'Favorite Songs');
assert.equal(suppliedResult.playlist.tracks.length, 3);
assert.equal(suppliedResult.tracks.length, 3);
assert.deepEqual(Array.from(imported, (track) => track.title), ['Hollow Knight', 'Crystal Peak', 'Когда ты грустишь']);
assert.equal(playedIndex, 0);
assert.equal(input.value, '');
assert.equal(fetchedUrl, `https://r.jina.ai/${suppliedUrl}`);
assert.ok(suppliedStatuses.some((text) => /3 tracks · 3 matched · 3 new/.test(text)));
assert.equal(matchCalls.length, 8);

const router = fs.readFileSync('fast-import-v150.js', 'utf8');
assert.match(router, /apple-playlist-import-v150\.js\?v=150/);
assert.match(router, /apple\?\.type === 'playlist'\) \{ await importApplePlaylist\(apple\.url\); return; \}/);
assert.doesNotMatch(router, /playlists need MusicKit connection/);

console.log('Apple Music public playlist import: OK');
