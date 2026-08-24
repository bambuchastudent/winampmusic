import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../equalizer-v150.js', import.meta.url), 'utf8');

assert.match(html, /id="eqToggle"[^>]*aria-expanded="false"/);
assert.match(html, /id="equalizerPanel"[^>]*hidden/);
assert.match(html, /id="eqCapabilityNote"/);
assert.match(html, /visual only/i);
assert.match(html, /provider audio/i);
assert.equal((html.match(/data-eq-band=/g) || []).length, 11, 'PRE + 10 EQ bands must be present');
assert.match(html, /<script src="\.\/equalizer-v150\.js\?v=150" defer><\/script>/);
assert.ok(html.indexOf('fast-player-v141.js?v=150') < html.indexOf('equalizer-v150.js?v=150'), 'EQ must not own the fast core');
assert.match(js, /ampula\.eq\.expanded\.v1/);
assert.match(js, /ampula\.eq\.bands\.v1/);
assert.match(js, /window\.ampulaEqualizer/);
assert.match(js, /setCapability/);
assert.match(js, /canFilter/);

console.log('equalizer UI contract: ok');
