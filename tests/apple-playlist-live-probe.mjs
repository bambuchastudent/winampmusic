const playlist = 'https://music.apple.com/tr/playlist/thexx/pl.u-V9D7mR7TaB8Zkl';
const targets = [
  ['page', playlist],
  ['allorigins', `https://api.allorigins.win/raw?url=${encodeURIComponent(playlist)}`],
  ['codetabs', `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(playlist)}`],
  ['corsproxy', `https://corsproxy.io/?url=${encodeURIComponent(playlist)}`],
  ['jina', `https://r.jina.ai/${playlist}`],
];

for (const [label, url] of targets) {
  try {
    const response = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 AmpMusic/1.5' } });
    const text = await response.text();
    console.log('---', label, '---');
    console.log('STATUS', response.status);
    console.log('FINAL_URL', response.url);
    console.log('CONTENT_TYPE', response.headers.get('content-type'));
    console.log('ACAO', response.headers.get('access-control-allow-origin'));
    console.log('LENGTH', text.length);
    console.log('HAS_PLAYLIST_ID', text.includes('pl.u-V9D7mR7TaB8Zkl'));
    console.log('HAS_TRACK_LOCKUP', text.includes('track-lockup'));
    console.log('HAS_ARTIST_NAME', text.includes('artistName'));
    console.log('HEAD', text.slice(0, 700).replace(/\s+/g, ' '));
  } catch (error) {
    console.log('---', label, '---');
    console.log('ERROR', error?.name, error?.message);
  }
}
