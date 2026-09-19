# Design

## Boundary

Two independent optional transports exist:

- `relay/short-link/`: opaque Ámpula alias storage only, provider-agnostic;
- `relay/youtubejs/`: stateless browser transport for anonymous YouTube.js requests.

Neither belongs to Ámpula Core.

## Dedicated playback relay

The playback Worker accepts `GET`, `POST`, `HEAD`, and `OPTIONS` under `/youtubejs/*`. The target is reconstructed as HTTPS from the request path plus `__host`.

Allowed targets are limited to YouTube-owned hosts required by browser YouTube.js:
- `youtube.com` and subdomains;
- `youtubei.googleapis.com`;
- `ytimg.com` and subdomains;
- `googlevideo.com` and subdomains.

Only a small request-header allowlist is copied. Cookie, Authorization, Proxy-Authorization and unrelated headers are never forwarded.

## Runtime configuration

A checked-in inert `youtubejs-relay-config.js` defines:

`window.AMPULA_YOUTUBEJS_RELAY = ''`

During Pages delivery, if the dedicated Worker deploys and `/healthz` succeeds, CI replaces only the artifact copy with the public HTTPS Worker base URL.

`fast-release-v150.js` loads the config before loading `youtubejs-audio-first-v181.js`, so the adapter can prefer the first-party relay without putting optional provider code on the synchronous FAST path.

## Media bytes

The dedicated relay is for API/player resolution. The resolved signed media URL remains assigned directly to the persistent native `HTMLAudioElement`; audio bytes are not intentionally proxied through project infrastructure.

## Failure

The two Workers fail independently. A short-link outage does not affect playback configuration. A YouTube.js relay outage does not affect canonical sharing. Missing Cloudflare credentials disable both optional deployments while Pages and Ámpula Core remain functional.
