import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function normalizeRelayUrl(value) {
  let raw = String(value ?? '').trim();
  if (!raw) return '';

  // wrangler-action has historically returned values such as
  // `example.workers.dev (custom domain)`. Only the first token is the URL.
  raw = raw.split(/\s+/)[0];
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
    // A protocol-less deployment value is expected to be a hostname. Requiring
    // a dot avoids treating arbitrary log words such as "Uploaded" as hosts.
    if (!raw.includes('.')) return '';
    raw = `https://${raw}`;
  }

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

export function relayUrlFromOutputs(deploymentUrl, commandOutput = '') {
  const direct = normalizeRelayUrl(deploymentUrl);
  if (direct) return direct;

  // Keep this deliberately generic: Wrangler may print a workers.dev URL or a
  // custom-domain URL. We validate every candidate with normalizeRelayUrl().
  const candidates = String(commandOutput ?? '').match(/https:\/\/[^\s)]+/g) || [];
  for (const candidate of candidates.reverse()) {
    const relay = normalizeRelayUrl(candidate);
    if (relay) return relay;
  }
  return '';
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
  const relay = relayUrlFromOutputs(
    process.env.RELAY_DEPLOYMENT_URL || process.argv[3] || '',
    process.env.RELAY_COMMAND_OUTPUT || '',
  );

  fs.writeFileSync(outputPath, renderRelayConfig(relay), 'utf8');
  writeGithubOutput(relay);

  if (relay) console.log(`Ámpula short-link relay configured: ${relay}`);
  else console.log('Ámpula short-link relay disabled; canonical share links remain active.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
