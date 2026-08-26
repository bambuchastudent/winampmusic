import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function normalizeRelayUrl(value) {
  let raw = String(value ?? '').trim();
  if (!raw) return '';

  // wrangler-action has historically returned values such as
  // `example.workers.dev (custom domain)`. Only the first token is the URL.
  raw = raw.split(/\s+/)[0];
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    url.search = '';
    url.hash = '';
    url.pathname = `${url.pathname.replace(/\/*$/, '')}/`;
    return url.toString();
  } catch {
    return '';
  }
}

export function renderRelayConfig(value) {
  const relay = normalizeRelayUrl(value);
  const assignment = relay
    ? `window.AMPULA_SHORT_LINK_RELAY = window.AMPULA_SHORT_LINK_RELAY || ${JSON.stringify(relay)};`
    : "window.AMPULA_SHORT_LINK_RELAY = window.AMPULA_SHORT_LINK_RELAY || '';";

  return `(() => {\n  'use strict';\n  // Generated during production delivery. Contains public transport routing only.\n  ${assignment}\n})();\n`;
}

function writeGithubOutput(relay) {
  const output = process.env.GITHUB_OUTPUT;
  if (!output) return;
  fs.appendFileSync(output, `relay_url=${relay}\n`, 'utf8');
}

function main() {
  const outputPath = process.argv[2] || 'ampula-short-link-config.js';
  const raw = process.env.RELAY_DEPLOYMENT_URL || process.argv[3] || '';
  const relay = normalizeRelayUrl(raw);

  fs.writeFileSync(outputPath, renderRelayConfig(relay), 'utf8');
  writeGithubOutput(relay);

  if (relay) console.log(`Ámpula short-link relay configured: ${relay}`);
  else console.log('Ámpula short-link relay disabled; canonical share links remain active.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
