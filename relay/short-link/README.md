# Ámpula short-link relay

> **Status: NOT DEPLOYED.**
> This directory contains deployable source. No production relay exists for this project, and
> nothing in this repository calls one. Anonymous short-link *creation* only starts working after an
> operator completes the deployment steps below and configures the app.
>
> Short-link **resolution** does not need this relay — see [Do you actually need this?](#do-you-actually-need-this).

The relay is the `relay` adapter of the alias contract in
[`openspec/changes/short-share-links-v1.6.3/specs/short-link-alias/spec.md`](../../openspec/changes/short-share-links-v1.6.3/specs/short-link-alias/spec.md).

## What it is

A pointer service. It stores an opaque compact Ámpula transport payload under a random token and
gives that payload back.

**An alias record contains the complete payload**, so dereferencing it lets the client rebuild the
canonical self-contained `?a=` URL locally. The relay is therefore a shortcut, never a source of
truth. If it disappears, no musical moment is lost — only the shortcuts are.

It never decodes, decompresses, rewrites, enriches or indexes the musical content, and it stores no
user, device or session identifier.

## Do you actually need this?

| You want | You need |
| --- | --- |
| A short link for a curated/pinned/demo moment | **No relay.** Use `scripts/create-short-link.mjs` — static aliases are served by GitHub Pages. |
| Any end user to mint a short link from the Share dialog | This relay, deployed and configured. |

## API contract v1

```text
POST /a
  Content-Type: application/json
  { "v": 1, "payload": "<encoding>.<base64url>" }

  201 { "v": 1, "token": "Ab3Xk9pQ2",
        "url": "https://<relay-origin>/a/Ab3Xk9pQ2",
        "expiresAt": "<ISO-8601>" }

GET /a/<token>
  302 Location: <APP_ORIGIN>?a=<payload>

GET /a/<token>?format=json
  200 { "v": 1, "payload": "<encoding>.<base64url>", "expiresAt": "<ISO-8601>" }

GET /healthz
  200 { "ok": true, "v": 1 }
```

### Errors

| Status | Meaning |
| --- | --- |
| `400` | malformed request or payload that is not a compact Ámpula transport string |
| `404` | unknown token |
| `410` | expired token |
| `413` | payload above the size limit |
| `429` | rate limited |
| `5xx` | relay fault |

Every error is safe for a client to treat as "alias unavailable": the client falls back to the
self-contained `?a=` link.

## Limits

| Limit | Value |
| --- | --- |
| Maximum payload | 64 KB |
| Token entropy | 9 base62 characters ≈ 53.6 bits (spec floor: 48 bits) |
| Creation rate | 30 per hour per client bucket |
| Retention | 180 days, not extended by reads |

## Failure modes

| Failure | Client behaviour |
| --- | --- |
| Not configured | No network call; share produces the canonical `?a=` link. |
| Offline / DNS / TLS failure | Bounded fetch rejects; canonical link retained; no user-facing error. |
| Slow | `AbortController` fires at 2500 ms; canonical link retained. |
| 4xx / 5xx / malformed body | Treated as unavailable; canonical link retained. |
| Token unknown or expired on receive | Non-destructive status; local library untouched; player usable. |

## Privacy

Stored per record: `payload`, `createdAt`, `expiresAt`. Nothing else.

- No accounts, no cookies, no analytics, no referrer capture, no playback telemetry.
- Rate limiting uses an ephemeral counter keyed by a salted, truncated hash of the client IP. The
  counter expires within the rate-limit window and is never stored alongside a payload.
- The payload is opaque to the relay but readable by its operator. The client never sends the relay
  anything that is not already inside the shareable link itself.
- Treat a deployed relay as a public host for the links people choose to shorten.

## Durability

Explicitly weak, by design.

- The relay may delete any token at any time.
- Tokens expire no later than the declared retention.
- Loss of a token is **not** recoverable from the relay and is **not** loss of the musical moment:
  the sender's self-contained link and `.ampula` export remain the durable representations.

## Deployment (required before any relay short link exists)

```bash
npm install -g wrangler
cd relay/short-link

# 1. Create the KV namespace and paste the printed id into wrangler.toml
wrangler kv namespace create AMPULA_LINKS

# 2. Set APP_ORIGIN to the deployed player and RATE_SALT to a private value
#    (edit wrangler.toml, or use `wrangler secret put RATE_SALT`)

# 3. Deploy
wrangler deploy

# 4. Verify
curl -s https://<relay-origin>/healthz
```

Then point the player at it, either at runtime:

```js
window.AMPULA_SHORT_LINK_RELAY = 'https://<relay-origin>';
```

or statically in `index.html`:

```html
<meta name="ampula-short-link-relay" content="https://<relay-origin>" />
```

Until one of those is present, `ampula-short-link-v163.js` reports no write backend and makes no
network request.

## Non-goals

This relay is not, and must not become, a catalog, account system, analytics endpoint, social graph,
playback source, or a required dependency of Ámpula Core.
