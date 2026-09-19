# AMPULAMP YouTube.js browser relay

This optional Cloudflare Worker exists only to make browser YouTube.js requests compatible with browser CORS restrictions.

It is **not** part of Ámpula Core, does not store tracks or audio, and is intentionally separate from the short-link alias Worker.

## Routes

- `GET /healthz` — health check.
- `GET|POST|HEAD /youtubejs/<path>?__host=<allowed-host>` — restricted HTTPS proxy for anonymous YouTube.js requests.
- `OPTIONS /youtubejs/*` — browser preflight.

Allowed upstreams are limited to YouTube-owned `youtube.com`, `youtubei.googleapis.com`, `ytimg.com`, and `googlevideo.com` hosts/subdomains.

Cookie, Authorization and Proxy-Authorization are never forwarded. Resolved media URLs are played directly by the browser; this Worker is not intended to carry normal audio payloads.

## Deployment

The Pages workflow deploys this Worker only when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured. It health-checks the deployment and writes only the public HTTPS base URL into the Pages artifact's `youtubejs-relay-config.js`.

Without those credentials the generated runtime config stays empty and Pages still deploys normally.

Manual deployment:

```bash
cd relay/youtubejs
wrangler deploy
curl -s https://<relay-origin>/healthz
```
