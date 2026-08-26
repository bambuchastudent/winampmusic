import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeRelayUrl, renderRelayConfig } from '../scripts/generate-short-link-config.mjs';

const wrangler = fs.readFileSync('relay/short-link/wrangler.toml', 'utf8');
const workflow = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const defaultConfig = fs.readFileSync('ampula-short-link-config.js', 'utf8');
const adapter = fs.readFileSync('ampula-short-link-v163.js', 'utf8');
const cleanup = fs.readFileSync('share-ui-cleanup-v162.js', 'utf8');
const spec = fs.readFileSync('openspec/changes/production-short-link-relay-v1.6.6/specs/short-link-production/spec.md', 'utf8');

assert.match(wrangler, /binding\s*=\s*"AMPULA_LINKS"/, 'relay must keep its KV binding');
assert.doesNotMatch(wrangler, /REPLACE_WITH_KV_NAMESPACE_ID|replace-me/, 'deployable config must have no account placeholder values');
assert.doesNotMatch(wrangler, /^RATE_SALT\s*=/m, 'RATE_SALT must not be a checked-in Worker var');
assert.doesNotMatch(wrangler, /^id\s*=\s*"/m, 'KV id must be provisioned for the target account instead of committed');

assert.match(workflow, /CLOUDFLARE_API_TOKEN/, 'Pages delivery must support Cloudflare deployment credentials');
assert.match(workflow, /CLOUDFLARE_ACCOUNT_ID/, 'Pages delivery must identify the Cloudflare account');
assert.match(workflow, /cloudflare\/wrangler-action@v4/, 'production relay must use the supported Wrangler action');
assert.match(workflow, /workingDirectory:\s*relay\/short-link/, 'Wrangler must deploy the relay directory');
assert.match(workflow, /wranglerVersion:\s*["']4\.102\.0["']/, 'Wrangler must be new enough for automatic KV provisioning');
assert.match(workflow, /continue-on-error:\s*true/, 'optional relay failure must not block Pages delivery');
assert.match(workflow, /RATE_SALT/, 'deployment must supply the private rate-limit salt');
assert.match(workflow, /generate-short-link-config\.mjs/, 'Pages artifact must receive runtime relay configuration');
assert.match(workflow, /healthz/, 'a produced relay URL must be health checked');

const configPos = index.indexOf('./ampula-short-link-config.js');
const actionsPos = index.indexOf('./fast-actions-v143.js');
assert.ok(configPos >= 0, 'index must load the relay runtime config');
assert.ok(actionsPos >= 0, 'index must load fast actions');
assert.ok(configPos < actionsPos, 'relay config must execute before fast actions can lazy-load the adapter');
assert.match(defaultConfig, /AMPULA_SHORT_LINK_RELAY/, 'checked-in config must define the runtime hook');
assert.doesNotMatch(defaultConfig, /workers\.dev|pages\.dev/, 'checked-in default config must not bind the app to a deployment');

assert.equal(normalizeRelayUrl('https://ampula-short-link.example.workers.dev'), 'https://ampula-short-link.example.workers.dev/');
assert.equal(normalizeRelayUrl('ampula-short-link.example.workers.dev (custom domain)'), 'https://ampula-short-link.example.workers.dev/');
assert.equal(normalizeRelayUrl('  https://relay.example.test/path/  '), 'https://relay.example.test/path/');
assert.equal(normalizeRelayUrl('http://relay.example.test'), '', 'non-HTTPS relay URLs must be rejected');
assert.equal(normalizeRelayUrl('not a url'), '', 'malformed deployment output must disable the relay');
assert.match(renderRelayConfig('https://relay.example.test'), /https:\/\/relay\.example\.test\//);
assert.match(renderRelayConfig(''), /AMPULA_SHORT_LINK_RELAY\s*=\s*window\.AMPULA_SHORT_LINK_RELAY\s*\|\|\s*''/, 'empty runtime config must remain inert');

assert.match(adapter, /canonical self-contained `\?a=` link is built first/, 'short-link adapter must remain optional to canonical sharing');
assert.match(cleanup, /this\.id === 'winampShareDialog'/, 'production relay work must not reintroduce the share modal');
assert.match(spec, /MUST preserve a deployable player when they are absent or the optional relay deployment fails/i);
assert.match(spec, /MUST NOT contain Cloudflare credentials, `RATE_SALT`, KV identifiers/i);
assert.match(spec, /canonical URL remains usable/i);

console.log('production short-link relay deployment contract passed');
