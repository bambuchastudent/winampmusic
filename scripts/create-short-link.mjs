#!/usr/bin/env node
/**
 * Mint a static Ámpula short-link alias served by GitHub Pages.
 *
 * This is the `static` adapter of the alias contract in
 * openspec/changes/short-share-links-v1.6.3/specs/short-link-alias/spec.md
 *
 * It needs no server: GitHub Pages 301-redirects `/a/<token>` to `/a/<token>/`
 * and serves `a/<token>/index.html`.
 *
 * Static aliases are PUBLIC and PERMANENT until removed by another commit.
 * Use them for curated moments, not for private sharing.
 *
 *   node scripts/create-short-link.mjs --url "https://…/winampmusic/?a=g.…"
 *   node scripts/create-short-link.mjs --url "…" --token launch --out a
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const TOKEN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export const PAYLOAD_RE = /^[gj]\.[A-Za-z0-9_-]{8,}$/;
export const TOKEN_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;
export const MAX_PAYLOAD_BYTES = 64 * 1024;

export function mintToken(length = 9) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]).join('');
}

export function payloadFromShareUrl(value) {
  const payload = new URL(String(value)).searchParams.get('a');
  if (!payload) throw new Error('Share URL has no ?a= payload');
  if (!PAYLOAD_RE.test(payload)) throw new Error('Share URL payload is not a compact Ámpula transport string');
  if (Buffer.byteLength(payload, 'utf8') > MAX_PAYLOAD_BYTES) throw new Error('Payload exceeds the 64 KB alias limit');
  return payload;
}

/**
 * The redirect document must reach the canonical `?a=` URL without the player
 * bundle and without any third-party script.
 */
export function redirectDocument(payload) {
  const target = `../../?a=${payload}`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="noindex,nofollow" />
<meta http-equiv="refresh" content="0; url=${target}" />
<title>Opening shared music…</title>
</head>
<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#15181e;color:#fff;font:600 14px/1.5 system-ui,sans-serif">
<p>Opening shared music… <a href="${target}" style="color:#f0c94d">continue</a></p>
<script>location.replace(${JSON.stringify(target)});</script>
</body>
</html>
`;
}

export function aliasRecord(payload) {
  return { v: 1, payload, expiresAt: null };
}

export function writeAlias({ payload, token, outDir }) {
  if (!PAYLOAD_RE.test(payload)) throw new Error('Refusing to write a non-Ámpula payload');
  if (!TOKEN_RE.test(token)) throw new Error(`Invalid alias token: ${token}`);
  const dir = path.join(outDir, token);
  if (fs.existsSync(dir)) throw new Error(`Alias already exists: ${token}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), redirectDocument(payload));
  fs.writeFileSync(path.join(outDir, `${token}.json`), `${JSON.stringify(aliasRecord(payload), null, 2)}\n`);
  return { token, indexPath: path.join(dir, 'index.html'), jsonPath: path.join(outDir, `${token}.json`) };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    args[key.slice(2)] = argv[i + 1]?.startsWith('--') ? 'true' : argv[i + 1];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error('Usage: node scripts/create-short-link.mjs --url "<canonical ?a= share URL>" [--token <token>] [--out a]');
    process.exit(2);
  }
  const outDir = args.out || 'a';
  const payload = payloadFromShareUrl(args.url);
  const token = args.token || mintToken();
  fs.mkdirSync(outDir, { recursive: true });
  const written = writeAlias({ payload, token, outDir });

  const appUrl = new URL(args.url);
  appUrl.search = '';
  appUrl.hash = '';
  const base = appUrl.toString().replace(/\/?$/, '/');

  console.log(`Alias written: ${written.indexPath}`);
  console.log(`Alias record:  ${written.jsonPath}`);
  console.log(`Short link:    ${base}${outDir}/${token}`);
  console.log('Commit and deploy to make it live. Static aliases are public and permanent until removed.');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
