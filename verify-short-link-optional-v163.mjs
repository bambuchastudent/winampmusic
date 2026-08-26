import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`./${file}`, import.meta.url), 'utf8');

const index = read('index.html');
const actions = read('fast-actions-v143.js');
const shortLink = read('ampula-short-link-v163.js');
const compactShare = read('compact-share.js');
const fileOpen = read('ampula-file-open-v1.js');
const sw = read('sw.js');
const readme = read('README.md');

const fail = (message) => { throw new Error(message); };

// The alias is optional and lazy: nothing about it may enter the startup critical path.
if (index.includes('ampula-short-link')) fail('Short-link support must not be a startup script');
if (index.includes('AMPULA_SHORT_LINK_RELAY')) fail('This repository must not configure a write relay');
if (!actions.includes("loadScript('./ampula-short-link-v163.js?v=163', 'ampula-short-link')")) {
  fail('Share must lazily load the alias module');
}
if (!actions.includes("params.has('al')")) fail('The alias receive path must be wired');
if (!actions.includes("loadScript('./qr-share-v1.js?v=161', 'qr-share')")) fail('QR must still be loaded from the Share flow');
if (!sw.includes('./ampula-short-link-v163.js')) fail('The alias module must be precached with the shell');

// The canonical link must exist before, and survive, any alias attempt.
const shareBlock = actions.slice(actions.indexOf('shareButton.addEventListener'), actions.indexOf('let clearArmedUntil'));
if (!/const url = await window\.winampMusicCompactShare\.share\(\);/.test(shareBlock)) {
  fail('Share must still build the canonical self-contained link first');
}
if (/await window\.ampulaShortLink/.test(shareBlock)) {
  fail('The Share handler must not await the alias attempt: it would put a relay on the interaction path');
}

// Alias tokens must never survive into a rebuilt app URL.
for (const [name, source] of [['compact-share.js', compactShare], ['ampula-file-open-v1.js', fileOpen], ['fast-actions-v143.js', actions]]) {
  if (!/\[(?:AMPULA_PARAM|'a'), 'al', 'p', 's', 'playlist'\]/.test(source)) {
    fail(`${name} must strip the alias parameter when rebuilding the app URL`);
  }
}

// Bounded, non-destructive failure.
for (const needle of ['AbortController', 'timeoutMs', 'maxPayloadBytes', 'SHORT LINK EXPIRED OR UNAVAILABLE']) {
  if (!shortLink.includes(needle)) fail(`Alias client must implement: ${needle}`);
}
if (!/const relayBase = |function relayBase/.test(shortLink)) fail('Alias backend configuration must be explicit');
if (/setStatus\('SHARE UNAVAILABLE/.test(shortLink)) fail('An alias failure must not be reported as a share failure');

// A public shortener must never be the source of truth.
const runtime = [actions, shortLink, compactShare, fileOpen, read('legacy-share-v1.js'), read('qr-share-v1.js')].join('\n');
for (const host of ['bit.ly', 'tinyurl.com', 't.co', 'is.gd', 'goo.gl', 'ow.ly']) {
  const asProvider = new RegExp(`(?:https?:)?//(?:www\\.)?${host.replace('.', '\\.')}`);
  if (asProvider.test(runtime)) fail(`A public shortener must not be used as an alias provider: ${host}`);
}
if (!shortLink.includes('BLOCKED_HOSTS')) fail('Alias client must refuse public shorteners as a configured backend');

// Deployment status must be stated, not implied.
if (!/not deployed/i.test(readme)) fail('README must state that no production relay is deployed');
if (!/create-short-link/.test(readme)) fail('README must document the alias path that works without a relay');

console.log('short-link alias stays optional, lazy, first-party and honest about deployment');
