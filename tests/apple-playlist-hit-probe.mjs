const playlistId = 'pl.u-JPAZE8mFBD6eAr';
const sources = [
  ['jina', `https://r.jina.ai/https://music.apple.com/tr/playlist/hit/${playlistId}`],
  ['embed-slug', `https://embed.music.apple.com/tr/playlist/hit/${playlistId}`],
  ['embed-id', `https://embed.music.apple.com/tr/playlist/${playlistId}`],
];
for (const [label, url] of sources) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 AmpMusic/1.5',
        'Origin': 'https://bambuchastudent.github.io',
      },
    });
    const text = await response.text();
    console.log(`--- ${label} ---`);
    console.log('STATUS', response.status, 'FINAL', response.url);
    console.log('LENGTH', text.length);
    console.log('PREVIEW_COUNT', (text.match(/PREVIEW/gi) || []).length);
    console.log('SONG_WORDS', (text.match(/"songs"/g) || []).length);
    console.log('CATALOG_IDS', (text.match(/catalogId|catalog-id|adamId|songId|trackId/gi) || []).length);
    console.log('JSON_NAMES', (text.match(/"name"\s*:/g) || []).length);
    console.log('HEAD', text.slice(0, 6000).replace(/\s+/g, ' '));
  } catch (error) {
    console.log(label, 'ERROR', error?.name, error?.message);
  }
}
