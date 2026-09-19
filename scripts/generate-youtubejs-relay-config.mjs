import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { normalizeRelayUrl, relayUrlFromOutputs } from './generate-short-link-config.mjs';

export function renderYoutubeJsRelayConfig(value) {
  const relay = normalizeRelayUrl(value);
  const assignment = relay
    ? `window.AMPULA_YOUTUBEJS_RELAY = window.AMPULA_YOUTUBEJS_RELAY || ${JSON.stringify(relay)};`
    : "window.AMPULA_YOUTUBEJS_RELAY = window.AMPULA_YOUTUBEJS_RELAY || '';";

  return `(() => {\n  'use strict';\n  // Generated during production delivery. Contains public playback transport routing only.\n  ${assignment}\n})();\n`;
}

function writeGithubOutput(relay) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  fs.appendFileSync(output, `relay_url=${relay}\n`, 'utf8');
}

function main() {
  const outputPath = process.argv[2] || 'youtubejs-relay-config.js';
  const relay = relayUrlFromOutputs(
    process.env.RELAY_DEPLOYMENT_URL || process.argv[3] || '',
    process.env.RELAY_COMMAND_OUTPUT || '',
  );

  fs.writeFileSync(outputPath, renderYoutubeJsRelayConfig(relay), 'utf8');
  writeGithubOutput(relay);

  if (relay) console.log(`YouTube.js relay configured: ${relay}`);
  else console.log('YouTube.js relay disabled; browser fallback behavior remains active.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
