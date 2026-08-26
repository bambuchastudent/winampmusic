# Ámpula short-link relay

> **Status: production-delivery integrated.**
> The Pages workflow deploys this Worker when `CLOUDFLARE_API_TOKEN` and
> `CLOUDFLARE_ACCOUNT_ID` are configured in the repository. If the credentials
> are absent, invalid, or Cloudflare is unavailable, AMPULAMP publishes normally
> with the canonical self-contained `?a=` share path and no relay dependency.

The relay implements the `relay` adapter of the alias contract in
[`openspec/changes/short-share-links-v1.6.3/specs/short-link-alias/spec.md`](../../openspec/changes/short-share-links-v1.6.3/specs/short-link-alias/spec.md).
Production wiring is specified by
[`openspec/changes/production-short-link-relay-v1.6.6/`](../../openspec/changes/production-short-link-relay-v1.6.6/).

## What it is

A pointer service. It stores an opaque compact Ámpula transport payload under a random token and
gives that payload back.

**An alias record contains the complete payload**, so dereferencing it lets the client rebuild the
canonical self-contained `?a=` URL locally. The relay is therefore a shortcut, never a source of
truth. If it disappears, only aliases are lost; `.ampula` and canonical `?a=` transports remain
independent.

The relay never decodes, decompresses, rewrites, enriches or indexes musical content and stores no
user, device or session identifier.

## API contract v1

```text
POST /a
  Content-Type: application/json
  { "v": 1, "payload": "<encoding>.<base64url>" }

  201 { "v": 1, "token": "Ab3Xk9pQ2",
        "url": "https://<relay-origin>/a/Ab3Xk9pQ2",
        "expiresAt": "<ISO-8601>" }

GET /a/<token>
  302 Location: <APP_URL>?a=<payload>

GET /a/<token>?format=json
  200 { "v": 1, "payload": "<encoding>.<base64url>", "expiresAt": "<ISO-8601>" }

GET /healthz
  200 { "ok": true, "v": 1 }
```

CORS allows the origin derived from `APP_URL`.

Errors are intentionally safe for the browser adapter to interpret as “alias unavailable”:

- `400` malformed request/payload;
- `404` unknown token;
- `410` expired token;
- `413` payload too large;
- `429` rate limited;
- `503` storage/rate limiter unavailable;
- other `5xx` relay faults.

The browser already has the canonical URL before it asks the relay, so any of these keeps sharing
functional.

## Limits

- maximum payload: 64 KB;
- token: 9 base62 characters, about 53.6 bits of entropy;
- creation rate: 30 aliases/hour/client bucket;
- retention: 180 days, not extended by reads.

The creation limiter is a Durable Object rather than KV because the limiter needs atomic
read-modify-write behaviour. It stores only a temporary counter. Payload storage is separate KV.

## Privacy

Stored per alias: `payload`, `createdAt`, `expiresAt`.

- No accounts, cookies, analytics, referrer capture or playback telemetry.
- Rate limiting hashes the client IP with `RATE_SALT`; production CI passes that value as a Worker
  secret, not as browser configuration or a committed variable.
- The payload is opaque to the relay implementation but readable by the relay operator. It is the
  same payload the sender already chose to make shareable.

## Production deployment

Production is wired through `.github/workflows/pages.yml`.

Add these repository Actions secrets:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

The API token needs permission to deploy Workers and create/use the resources declared by the
Worker. The Cloudflare account also needs a usable Workers deployment domain (normally its
`workers.dev` subdomain, or an equivalent configured route/domain).

On a `develop` Pages delivery, the workflow:

1. detects whether both Cloudflare credentials exist;
2. generates an ephemeral `RATE_SALT` and masks it in the Actions log;
3. deploys this directory with `cloudflare/wrangler-action` and Wrangler 4.102.0;
4. lets Wrangler automatically provision/link `AMPULA_LINKS` KV because the binding intentionally
   has no account-specific id in `wrangler.toml`;
5. captures the public deployment URL and writes `ampula-short-link-config.js` into the Pages
   artifact;
6. checks `<relay>/healthz`;
7. if deployment or health fails, replaces the runtime config with the inert default and proceeds
   with the normal Pages deploy.

No Cloudflare account id, API token, KV id or rate-limit salt is shipped to browser code. The only
relay-specific value in the production Pages artifact is the public HTTPS relay base URL.

### Why relay failure does not block Pages

Shortening is optional transport convenience. Failing the whole player deployment because the
shortener is unavailable would invert the architecture. The canonical self-contained link is built
first and remains the guaranteed path.

## Manual deployment

CI is the preferred production path, but the Worker can still be deployed manually with a current
Wrangler:

```bash
cd relay/short-link
wrangler secret put RATE_SALT
wrangler deploy
curl -s https://<relay-origin>/healthz
```

`AMPULA_LINKS` does not need a committed namespace id: current Wrangler can provision the declared
KV binding for the target account. `APP_URL` is already set to the production GitHub Pages player in
`wrangler.toml`.

For a manual player build, configure the public relay base before `ampula-short-link-v163.js` runs:

```js
window.AMPULA_SHORT_LINK_RELAY = 'https://<relay-origin>/';
```

The repository's checked-in `ampula-short-link-config.js` is intentionally inert; production CI
replaces only the deployment artifact copy.

## Static aliases

A relay is not required for curated/pinned aliases. `scripts/create-short-link.mjs` can create
static aliases under `a/` that GitHub Pages serves directly.

## Failure modes

- relay not configured: no relay call; canonical `?a=` link remains;
- offline / DNS / TLS failure: bounded client fetch fails; canonical link remains;
- slow relay: client aborts after 2500 ms; canonical link remains;
- rate limit / 4xx / 5xx / malformed response: canonical link remains;
- expired alias on receive: shared alias reports unavailable without mutating the local library;
- complete relay loss: aliases can disappear, but Ámpula Core and self-contained transports do not.

## Non-goals

This relay is not, and must not become, a catalog, account system, analytics endpoint, social graph,
playback source, centralized Ámpula store, or a required dependency of Ámpula Core.
