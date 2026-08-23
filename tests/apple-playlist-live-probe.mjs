const playlist = 'https://music.apple.com/tr/playlist/thexx/pl.u-V9D7mR7TaB8Zkl';
const targets = [
  ['page', playlist],
  ['oembed', `https://music.apple.com/api/oembed?url=${encodeURIComponent(playlist)}`],
  ['embed', 'https://embed.music.apple.com/tr/playlist/thexx/pl.u-V9D7mR7TaB8Zkl'],
];

for (const [label, url] of targets) {
  const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 AmpMusic/1.5' } });
  const text = await response.text();
  console.log('---', label, '---');
  console.log('STATUS', response.status);
  console.log('FINAL_URL', response.url);
  console.log('CONTENT_TYPE', response.headers.get('content-type'));
  console.log('ACAO', response.headers.get('access-control-allow-origin'));
  console.log('LENGTH', text.length);
  console.log('HEAD', text.slice(0, 1200).replace(/\s+/g, ' '));
  console.log('HAS_PLAYLIST_ID', text.includes('pl.u-V9D7mR7TaB8Zkl'));
  console.log('SCRIPT_TYPES', [...text.matchAll(/<script[^>]*type=["']([^"']+)["'][^>]*>/gi)].map((m) => m[1]).slice(0, 20));
  for (const needle of ['application/ld+json', 'application/json', 'seoData', 'artistName', 'track-lockup', 'songs']) {
    const i = text.indexOf(needle);
    console.log('NEEDLE', needle, i, i >= 0 ? text.slice(Math.max(0, i - 180), i + 800).replace(/\s+/g, ' ') : '');
  }
}
