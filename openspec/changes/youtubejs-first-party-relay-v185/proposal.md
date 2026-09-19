# Proposal: first-party YouTube.js browser relay

## Problem

YouTube.js is correctly isolated and invoked in the browser, but InnerTube/player requests fail before resolution because browsers cannot call the required YouTube endpoints cross-origin. Public CORS relays are unreliable and have already failed in production testing.

## Goal

Use the repository's optional Cloudflare Worker deployment as a restricted first-party transport for YouTube.js browser requests.

## Scope

- add a dedicated `/youtubejs/*` proxy route to the existing optional Worker;
- allow only HTTPS requests to a small YouTube-owned host allowlist;
- forward only the request methods and headers needed by anonymous YouTube.js;
- never forward browser cookies or authorization credentials;
- configure the browser adapter to try the first-party relay before direct/public fallbacks;
- keep resolved Googlevideo media playback on the native media element rather than proxying audio bytes;
- preserve all track identity/origin metadata.

## Non-goals

- no account/login proxy;
- no general-purpose open proxy;
- no catalog or central music service;
- no change to Ámpula Core;
- no mandatory backend for Ámpula itself.

## Success criteria

When the optional Worker is deployed, `?playback=youtubejs` can route YouTube.js InnerTube/player requests through the Worker. The Worker refuses unrelated hosts and credentials. If Cloudflare credentials are absent, Pages still deploys and the UI reports the transport failure rather than silently using iframe in YouTube.js-only mode.
