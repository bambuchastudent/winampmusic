const base = 'https://embed.music.apple.com/build/';
const seen = new Set();
const queue = ['web-embed.esm.js'];
const needles = ['amp-api', 'api.music.apple.com', '/v1/', 'developerToken', 'musicKit', 'playlist', 'playlists', 'catalog'];
while (queue.length && seen.size < 30) {
  const name = queue.shift();
  if (!name || seen.has(name)) continue;
  seen.add(name);
  const response = await fetch(new URL(name, base), { headers: { 'user-agent': 'Mozilla/5.0 AmpMusic/1.5' } });
  const text = await response.text();
  console.log('FILE', name, 'STATUS', response.status, 'LEN', text.length);
  const refs = new Set();
  for (const match of text.matchAll(/(?:from\s*|import\()?["']\.\/([^"']+\.js)["']/g)) refs.add(match[1]);
  for (const ref of refs) if (!seen.has(ref)) queue.push(ref);
  for (const needle of needles) {
    let index = text.indexOf(needle);
    if (index >= 0) {
      console.log('HIT', needle, 'IN', name);
      console.log(text.slice(Math.max(0, index - 900), Math.min(text.length, index + 1800)).replace(/\s+/g, ' '));
    }
  }
}
console.log('FILES', [...seen]);
