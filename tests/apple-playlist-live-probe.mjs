const playlist = 'https://music.apple.com/tr/playlist/thexx/pl.u-V9D7mR7TaB8Zkl';
const origin = 'https://bambuchastudent.github.io';
const targets = [
  ['page', playlist],
  ['jina', `https://r.jina.ai/${playlist}`],
];

for (const [label, url] of targets) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 AmpMusic/1.5', origin },
    });
    const text = await response.text();
    console.log('---', label, '---');
    console.log('STATUS', response.status);
    console.log('ACAO', response.headers.get('access-control-allow-origin'));
    console.log('VARY', response.headers.get('vary'));
    console.log('LENGTH', text.length);
    console.log('HAS_PLAYLIST_ID', text.includes('pl.u-V9D7mR7TaB8Zkl'));
    console.log('HEAD', text.slice(0, 1200).replace(/\s+/g, ' '));
  } catch (error) {
    console.log('---', label, '---');
    console.log('ERROR', error?.name, error?.message);
  }
}
