const url = 'https://embed.music.apple.com/build/web-embed.esm.js';
const response = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 AmpMusic/1.5' } });
const text = await response.text();
console.log('STATUS', response.status, 'LEN', text.length);
for (const needle of ['amp-api', 'api.music.apple.com', '/v1/catalog', 'developerToken', 'playlist', 'playlists']) {
  console.log(`--- ${needle} ---`);
  let index = text.indexOf(needle);
  let shown = 0;
  while (index >= 0 && shown < 8) {
    console.log(text.slice(Math.max(0, index - 500), Math.min(text.length, index + 900)).replace(/\s+/g, ' '));
    shown += 1;
    index = text.indexOf(needle, index + needle.length);
  }
}
