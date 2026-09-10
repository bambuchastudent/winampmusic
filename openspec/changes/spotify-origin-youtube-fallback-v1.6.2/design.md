# Design

## Import

`stable-v150.js` intercepts Spotify playlist submissions before the legacy unified-entry Spotify handler. It lazy-loads `spotify-origin-import-v162.js` and never creates a Spotify iframe.

The importer reads public playlist metadata from a browser-callable metadata service, normalizes each item into an Ámpula track, and stores Spotify track and playlist identifiers/URLs as provenance. Spotify preview URLs are intentionally ignored.

## Playback

Imported Spotify tracks initially have a local recording identity. A background resolver uses the existing cross-provider YouTube matcher with Spotify title, artist and duration. A successful match replaces only the playable ID and records `playbackProvider: youtube`; Spotify title, artist and provenance remain authoritative metadata.

Core playback retains its existing unresolved-track repair path as a second fallback when a background match is not ready yet.

## UI

No Spotify panel, iframe or provider-specific mini-player is rendered. The existing player remains the only visible player. `origin-playback-v151.js` renders provenance as, for example, `Origin · Spotify · Playing · YouTube`.
