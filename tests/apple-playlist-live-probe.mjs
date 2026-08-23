const url = 'https://music.apple.com/tr/playlist/thexx/pl.u-V9D7mR7TaB8Zkl';
const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 AmpMusic/1.5' } });
const text = await response.text();
console.log('STATUS', response.status);
console.log('FINAL_URL', response.url);
console.log('CONTENT_TYPE', response.headers.get('content-type'));
console.log('ACAO', response.headers.get('access-control-allow-origin'));
console.log('LENGTH', text.length);
console.log('HAS_PLAYLIST_ID', text.includes('pl.u-V9D7mR7TaB8Zkl'));
console.log('SCRIPT_TYPES', [...text.matchAll(/<script[^>]*type=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]).slice(0, 20));
for (const needle of ['application/ld+json', '__NEXT_DATA__', 'seoData', 'relationships', 'trackName', 'artistName', 'songName', 'songs']) {
  const i = text.indexOf(needle);
  console.log('NEEDLE', needle, i, i >= 0 ? text.slice(Math.max(0, i - 250), i + 1000).replace(/\s+/g, ' ') : '');
}
