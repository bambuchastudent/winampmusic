# Design

## Architecture

The existing optional Cloudflare Worker remains a transport helper, not part of Ámpula Core. It gains a second bounded capability:

`browser YouTube.js -> /youtubejs/<upstream-path>?__host=<allowed-host> -> YouTube-owned HTTPS endpoint`

The browser reads the already-generated public relay base URL from `window.AMPULA_SHORT_LINK_RELAY`. This variable name is legacy transport wiring; the relay URL is not stored in tracks or Ámpula objects.

## Request rules

The Worker accepts only `GET`, `POST`, `HEAD`, and `OPTIONS` on the YouTube.js route. The target protocol is always reconstructed as HTTPS by the Worker; the browser cannot choose a protocol.

Allowed hosts are restricted to:
- `youtube.com` and subdomains;
- `youtubei.googleapis.com`;
- `ytimg.com` and subdomains;
- `googlevideo.com` and subdomains.

The Worker forwards only a narrow header allowlist required by YouTube.js, such as content type, accept/language, range, and `x-goog-*` / `x-youtube-*` client headers. Cookie, Authorization, proxy authorization, and unrelated browser headers are never forwarded.

## CORS

CORS remains limited to the application origin derived from `APP_URL`. Preflight advertises only the headers/methods needed by the browser adapter.

## Media bytes

The first-party relay exists to make YouTube.js API/player resolution browser-compatible. A deciphered signed Googlevideo URL remains assigned directly to the persistent `HTMLAudioElement`; normal media playback does not require JavaScript to read the cross-origin response body. This avoids routing the audio payload through project infrastructure.

## Browser priority

The browser adapter tries the configured first-party relay before direct and public diagnostic candidates. Public candidates remain temporary fallback diagnostics until production relay deployment is verified.

## Failure

The relay must fail closed:
- invalid/missing host -> 400;
- disallowed host -> 403;
- unsupported method -> 405;
- upstream failure -> corresponding upstream status/body where safe.

No failure may rewrite title, artist, origin, source URL, or received Ámpula evidence.
