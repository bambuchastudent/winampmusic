const playlist = 'https://music.apple.com/tr/playlist/favourite-songs/pl.u-BpUq1XGL0';
for (const [label, url] of [
  ['page', playlist],
  ['jina', `https://r.jina.ai/${playlist}`],
]) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 AmpMusic/1.5',
        'Origin': 'https://bambuchastudent.github.io',
      },
    });
    const text = await response.text();
    console.log('---', label, '---');
    console.log('STATUS', response.status);
    console.log('ACAO', response.headers.get('access-control-allow-origin'));
    console.log('LENGTH', text.length);
    console.log('HAS_ID', text.includes('pl.u-BpUq1XGL0'));
    console.log('SONG_LINKS', [...text.matchAll(/music\.apple\.com\/[^)\s]+\/song\/[^)\s]+\/(\d+)/g)].slice(0, 20).map(m => m[0]));
    console.log('HEAD', text.slice(0, 5000).replace(/\s+/g, ' '));
  } catch (error) {
    console.log(label, 'ERROR', error?.name, error?.message);
  }
}
