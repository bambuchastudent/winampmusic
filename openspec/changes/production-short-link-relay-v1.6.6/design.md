# Design: production short-link relay v1.6.6

## Architecture

The existing split remains intact:

- `compact-share.js` creates the canonical self-contained `?a=` URL first.
- `ampula-short-link-v163.js` optionally asks a configured relay for an alias.
- `relay/short-link/worker.js` stores the opaque payload behind a random token.
- the receiver resolves an alias back to the same compact Ámpula payload and rebuilds the canonical route locally.

The relay is therefore transport convenience, not musical state or source of truth.

## Deployment ownership

`.github/workflows/pages.yml` remains the production delivery workflow. Its deploy job gets one optional stage before the Pages artifact is uploaded:

1. Detect whether both `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured.
2. If configured, deploy `relay/short-link` with Wrangler.
3. Provide `RATE_SALT` to Wrangler as a Worker secret; never render it into a file or Pages artifact.
4. Capture and normalize Wrangler's deployment URL.
5. Generate `ampula-short-link-config.js` containing only that public HTTPS relay origin.
6. Health-check `/healthz` when a relay URL was produced; reset the browser config to inert if health fails.
7. Upload the site to Pages.

Relay deployment is explicitly optional. A failed optional deploy must not prevent the existing Pages application from being published; in that case the generated runtime config leaves the relay disabled and the canonical share path remains active.

## Resource provisioning

The Worker config declares `AMPULA_LINKS` without an account-specific namespace id. Wrangler v4 automatic resource provisioning creates/links the KV resource for the target account. This keeps account identifiers out of the repository and makes the config reusable.

The Durable Object binding and its existing `v1` migration remain unchanged.

## Runtime configuration

A checked-in `ampula-short-link-config.js` is inert by default. Production CI overwrites that file in the deployment workspace after the optional Worker deploy. It is not committed back to git.

The config stays off the critical startup path. `fast-actions-v143.js` loads it immediately before it lazy-loads `ampula-short-link-v163.js` for either Share or `?al=` receive. This guarantees configuration is available before alias code executes without making short-link infrastructure part of normal playback startup.

The generator accepts potentially messy Wrangler Action output and normalizes it to one HTTPS origin/base URL. If the value is empty, malformed, or non-HTTPS it emits the inert configuration instead.

## Secrets and privacy

Required GitHub secrets for relay deployment:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

`RATE_SALT` is generated for the deployment job and uploaded as a Worker secret. It is not exposed to browser code. If secret delivery or Worker deployment fails, the optional deployment step is treated as unavailable and the Pages artifact stays on canonical sharing. The Pages artifact contains only the public relay URL.

The relay record format remains unchanged: opaque payload, creation time, expiry time. No account/session identity is introduced.

## Failure modes

- Missing Cloudflare credentials: relay stage skipped; generated config disables relay; Pages deploy continues.
- Invalid credentials / Cloudflare outage / secret-delivery failure / first-account bootstrap missing: optional relay step fails; generated config disables relay; Pages deploy continues.
- Wrangler produces an unusable deployment URL: config generator rejects it; canonical links remain primary fallback.
- Health check fails: runtime config is reset to inert before Pages upload.
- Runtime relay timeout or non-2xx: existing 2500 ms bounded adapter returns `null`; canonical URL stays copied.
- Alias expires or relay disappears later: alias can fail, but `.ampula` and canonical `?a=` transports remain independent and valid.

## Compatibility

No Ámpula Core/schema change. Existing `?a=`, `?al=`, static `/a/*.json`, `.ampula`, and legacy receive routes keep their current semantics. Share/receive remains dialogless.
