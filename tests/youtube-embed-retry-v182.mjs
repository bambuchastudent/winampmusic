import fs from 'node:fs';
import assert from 'node:assert/strict';

const loader = fs.readFileSync('fast-release-v150.js', 'utf8');
const runtime = fs.readFileSync('youtube-embed-retry-v182.js', 'utf8');

assert.match(loader, /youtube-embed-retry-v182\.js/);
assert.match(runtime, /101/);
assert.match(runtime, /150/);
assert.match(runtime, /title/);
assert.match(runtime, /artist/);
assert.match(runtime, /attempt/i);
assert.match(runtime, /videoId/);
assert.match(runtime, /window\.playIndex/);
assert.match(runtime, /YOUTUBE UNAVAILABLE/);
assert.match(runtime, /(?:track|freshTrack)\.id\s*=/);
assert.doesNotMatch(runtime, /(?:track|freshTrack)\.(title|artist|origin|sourceUrl)\s*=/);

console.log('YouTube embed retry contract OK');
