# Design

## URL routing
The existing `fastImportForm` remains the only import UI. YouTube parsing runs before single-video import. A valid `list` query parameter makes the URL a playlist import even if the same URL also contains `v=<videoId>`.

## Playlist resolution
AmpMusic already lazy-loads the official YouTube IFrame Player API for playback. Playlist import reuses that loader and creates a temporary hidden player configured with `listType=playlist` and the parsed playlist ID. After cueing the playlist, AmpMusic polls `getPlaylist()` until unique video IDs are available or a timeout is reached. The temporary player is then destroyed.

This avoids introducing a YouTube Data API key, server-side proxy, or third-party playlist service.

## Import and playback
Resolved IDs are passed to the existing `window.importTracks` API as normal AmpMusic tracks. Existing library deduplication remains authoritative. The first resolved playlist item is selected and played after import.

## Metadata
Playlist IDs are imported immediately so a large playlist does not block on metadata. Titles/artists are hydrated in the background through YouTube oEmbed. A small player-side metadata update API keeps the in-memory library and visible rows in sync without reloading the page.

## Failure behavior
Private, unavailable, malformed, or timed-out playlists leave the existing library unchanged and show a short status message in the same import card.
