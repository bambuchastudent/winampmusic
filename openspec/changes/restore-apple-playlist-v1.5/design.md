# Design

## Routing
`fast-import-v150.js` keeps the existing single field. Apple Music `/playlist/.../pl.*` URLs are routed to the Apple playlist importer instead of returning a placeholder.

## Public playlist discovery
The supplied public playlist was probed against the current Apple Music web player. Its public page contains the ordered five-track list, but Apple rejects cross-origin browser reads from the GitHub Pages origin. A browser-origin probe confirmed that the Jina Reader endpoint returns the same public playlist representation with CORS permission for `https://bambuchastudent.github.io`.

`apple-playlist-import-v150.js` therefore sends only the already-validated public `music.apple.com` playlist URL to `https://r.jina.ai/` and parses the reader's Markdown song rows. It extracts Apple song URL/ID, title, first artist, album and preview duration while preserving source order. No cookies, Apple credentials, library token, or AmpMusic user data are sent to the reader.

The parser is isolated behind `parsePlaylistMarkdown` so a future Apple/reader shape change can be adapted without changing the player or import UI.

## Resolution
Each Apple track is resolved with the existing `findYouTubeMatch` matcher from `apple-music-import-v064.js` (Piped first, Invidious fallback). Matching uses two workers to avoid hammering public providers. Results are written back into their original indices, so successful matches keep Apple playlist order even when requests finish out of order. A failed individual match does not abort the rest of the playlist.

## Playback and metadata
Imported tracks retain the Apple title/artist, Apple song ID/URL and source playlist URL as context, while the playable source is the locally resolved 11-character YouTube video ID. The existing library deduplicates those playable IDs and the first successfully resolved track starts playing.

## No backend / no login
The feature remains client-side and handles public shared playlists only. Private/library-only playlists remain out of scope without Apple authentication.
