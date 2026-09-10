# Design

## Architecture
Spotify support is a provider-specific import/playback adapter outside Ámpula Core. `spotify-playlist-embed-v160.js` owns URL parsing, known share-wrapper aliases, lazy loading of Spotify's official IFrame API, panel lifecycle, and local restoration of the last Spotify source.

## Ownership
- Unified music entry remains the single text/link entry surface.
- Spotify adapter intercepts only Spotify playlist URLs and explicitly registered aliases.
- Spotify embed owns Spotify playback UI. AMPULAMP core YouTube/Apple playback and `Your library` remain untouched.
- No Spotify catalogue metadata is copied into Ámpula Core in this change.

## Critical path
The Spotify IFrame API is loaded only after a Spotify source is requested or restored. Failure to load Spotify must not block startup, library rendering, YouTube playback, Apple playback, or Ámpula opening.

## Compatibility
Existing storage keys and provider adapters are unchanged. The adapter stores only optional UI state in `ampula.spotifySource.v1`.

## Failure modes
- Invalid/non-playlist Spotify URLs are ignored by this adapter.
- If Spotify embed fails, the panel shows a direct `Open in Spotify` fallback.
- `share.google` cannot be generically resolved without a server/CORS cooperation, so only aliases explicitly known to the client are mapped. The Better Call Saul share URL supplied for this change is registered.
