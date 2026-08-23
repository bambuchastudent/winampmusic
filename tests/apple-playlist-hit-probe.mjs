const playlistId = 'pl.u-JPAZE8mFBD6eAr';
const appleUrls = [
  ['tr-default', `https://music.apple.com/tr/playlist/hit/${playlistId}`],
  ['tr-tr', `https://music.apple.com/tr/playlist/hit/${playlistId}?l=tr`],
  ['tr-en', `https://music.apple.com/tr/playlist/hit/${playlistId}?l=en`],
  ['us', `https://music.apple.com/us/playlist/hit/${playlistId}`],
  ['gb', `https://music.apple.com/gb/playlist/hit/${playlistId}`],
];
for (const [label, appleUrl] of appleUrls) {
  try {
    const url = `https://r.jina.ai/${appleUrl}`;
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 AmpMusic/1.5',
        'Origin': 'https://bambuchastudent.github.io',
      },
    });
    const text = await response.text();
    const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim());
    console.log(`--- ${label} ---`);
    console.log('STATUS', response.status, 'LEN', text.length);
    console.log('TITLE', (text.match(/^Title:\s*(.+)$/m) || [])[1] || '');
    console.log('SONG_HEADER', lines.findIndex((line) => line === 'Song'));
    console.log('PREVIEW', (text.match(/PREVIEW/gi) || []).length);
    console.log('DURATIONS', lines.filter((line) => /^\d{1,2}:\d{2}$/.test(line)).length);
    console.log('SONG_LINKS', [...text.matchAll(/music\.apple\.com\/[^)\s]+\/song\/[^)\s]+\/(\d+)/g)].length);
    console.log('FEATURED', (text.match(/Featured Artists/gi) || []).length);
    const hitIndex = lines.findIndex((line) => line === '# Hit');
    console.log('AFTER_HIT', lines.slice(Math.max(0, hitIndex), Math.max(0, hitIndex) + 45));
  } catch (error) {
    console.log(label, 'ERROR', error?.name, error?.message);
  }
}
