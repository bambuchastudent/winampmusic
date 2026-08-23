# Design

## Routing
`fast-import-v150.js` keeps the existing single field. Apple Music `/playlist/.../pl.*` URLs are routed to the Apple importer instead of returning a placeholder.

## Public playlist discovery
For public shared playlists, the client first retrieves the public Apple Music web representation and extracts serialized playlist track metadata. The parser is deliberately tolerant of Apple web payload shape changes: it walks parsed JSON trees looking for song-like resources with stable title/artist metadata and preserves encounter order. If the direct page representation is unavailable, the UI reports a useful import failure rather than silently doing nothing.

## Resolution
Each Apple track is resolved with the existing `findYouTubeMatch` matcher from `apple-music-import-v064.js` (Piped first, Invidious fallback). Matching is concurrency-limited. Successfully matched tracks are imported in Apple playlist order; failed individual matches do not abort the whole playlist.

## Playback and metadata
Imported tracks carry the Apple playlist name/source URL as context, are deduplicated by the existing local library, and the first successfully resolved track starts playing.

## No backend / no login
The feature remains client-side and handles public shared playlists only. Private/library-only playlists remain out of scope without Apple authentication.
