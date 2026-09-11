# Design

## Primary path
Call `https://spotify.xwolf.space/api/playlist/:id` with a bounded request timeout. Successful payloads continue through the existing normalizer.

## Fallback path
If the primary request times out, aborts, returns non-2xx, returns `success:false`, or cannot be normalized:

1. Fetch `https://spotify.xwolf.space/api/token` with its own bounded timeout.
2. Require a non-empty bearer `access_token`.
3. Fetch Spotify playlist metadata from `https://api.spotify.com/v1/playlists/:id`.
4. Fetch tracks from `https://api.spotify.com/v1/playlists/:id/tracks?limit=50&offset=N` until all returned pages are consumed, with a hard client-side cap of 500 tracks.
5. Normalize those rows into the existing Spotify-origin track shape.

Each fallback request uses the caller abort signal plus an independent timeout; a stalled primary must not consume the whole import budget.

## Identity boundary
Spotify metadata remains origin/canonical metadata. No YouTube resolution is performed by this fallback and no provider playback id may replace title/artist.

## UX
During failover, status changes to `Spotify metadata retry…` so a slow primary does not look frozen. A final error is only shown after both paths fail.