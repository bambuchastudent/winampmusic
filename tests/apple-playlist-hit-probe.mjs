const playlist = 'https://music.apple.com/tr/playlist/hit/pl.u-JPAZE8mFBD6eAr';
const url = `https://r.jina.ai/${playlist}`;
const response = await fetch(url, {
  redirect: 'follow',
  headers: {
    'user-agent': 'Mozilla/5.0 AmpMusic/1.5',
    'Origin': 'https://bambuchastudent.github.io',
  },
});
const text = await response.text();
console.log('STATUS', response.status);
console.log('LENGTH', text.length);
console.log('TITLE', (text.match(/^Title:\s*(.+)$/m) || [])[1] || '');
console.log('NEWLINES', (text.match(/\n/g) || []).length);
console.log('PREVIEW_COUNT', (text.match(/PREVIEW/g) || []).length);
console.log('HEAD', text.slice(0, 7000).replace(/\s+/g, ' '));
const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, ' ').trim());
const songHeader = lines.findIndex((line) => line === 'Song');
const timeHeader = lines.findIndex((line, index) => index > songHeader && index < songHeader + 16 && line === 'Time');
console.log('SONG_HEADER', songHeader, 'TIME_HEADER', timeHeader);
const rows = [];
let fields = [];
if (songHeader >= 0 && timeHeader >= 0) {
  for (let i = timeHeader + 1; i < lines.length; i += 1) {
    const value = lines[i];
    if (!value || /^(?:PREVIEW|E|EXPLICIT|LOSSLESS|DOLBY ATMOS)$/i.test(value)) continue;
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      if (fields.length >= 3) rows.push({ title: fields[0], artist: fields[1], album: fields[2], time: value });
      fields = [];
      continue;
    }
    fields.push(value);
    if (fields.length > 8) fields = fields.slice(-8);
  }
}
console.log('PARSED_ROWS', rows.length);
console.log('FIRST', rows.slice(0, 5));
console.log('LAST', rows.slice(-5));
console.log('DURATION_LINES', lines.filter((line) => /^\d{1,2}:\d{2}$/.test(line)).length);
console.log('LINKED_SONGS', [...text.matchAll(/music\.apple\.com\/[^)\s]+\/song\/[^)\s]+\/(\d+)/g)].length);
