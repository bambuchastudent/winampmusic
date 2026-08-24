import crypto from 'node:crypto';
import fs from 'node:fs';

const outputPath = process.argv[2] || 'apple-music-config.js';
const teamId = String(process.env.APPLE_MUSIC_TEAM_ID || '').trim();
const keyId = String(process.env.APPLE_MUSIC_KEY_ID || '').trim();
const privateKeyRaw = String(process.env.APPLE_MUSIC_PRIVATE_KEY || '').trim();
const origin = String(process.env.APPLE_MUSIC_ORIGIN || 'https://bambuchastudent.github.io').trim();
const app = { name: 'AmpMusic', build: '1.5.0' };

function base64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function normalizedPrivateKey(value) {
  return value.includes('\\n') ? value.replace(/\\n/g, '\n') : value;
}

function buildDeveloperToken() {
  if (!teamId || !keyId || !privateKeyRaw) return '';
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlJson({ alg: 'ES256', kid: keyId });
  const payload = base64urlJson({
    iss: teamId,
    iat: now - 30,
    exp: now + 60 * 60 * 24 * 150,
    origin: [origin],
  });
  const unsigned = `${header}.${payload}`;
  const signature = crypto.sign('sha256', Buffer.from(unsigned), {
    key: normalizedPrivateKey(privateKeyRaw),
    dsaEncoding: 'ieee-p1363',
  }).toString('base64url');
  return `${unsigned}.${signature}`;
}

let developerToken = '';
try {
  developerToken = buildDeveloperToken();
} catch (error) {
  console.error('Could not generate Apple Music developer token:', error?.message || error);
  process.exitCode = 1;
}

const config = {
  enabled: Boolean(developerToken),
  developerToken,
  app,
};

fs.writeFileSync(
  outputPath,
  `window.AMP_MUSIC_APPLE_CONFIG = Object.freeze(${JSON.stringify(config, null, 2)});\n`,
  'utf8',
);

console.log(developerToken ? 'Apple Music MusicKit config generated.' : 'Apple Music MusicKit config disabled: repository secrets are not configured.');
