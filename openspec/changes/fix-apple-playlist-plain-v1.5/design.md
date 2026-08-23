# Design

## Detection
The Apple playlist URL router remains unchanged. Public playlists are still fetched through the current reader endpoint because Apple Music blocks direct cross-origin reads from GitHub Pages.

## Parsing
`parsePlaylistMarkdown` first attempts the existing linked-song parser. If no linked tracks are found, it looks for the plain table header sequence `Song`, `Artist`, `Album`, `Time` and reads rows in order. Empty/tab-only lines and presentation markers such as `PREVIEW` are ignored. A duration line closes the current row.

This fallback is deliberately limited to the public Apple table shape observed for the supplied playlist. It does not guess arbitrary free-form text.

## Playlist name
The title parser accepts both current Apple title forms: with or without the `- Apple Music` suffix, then removes the owner suffix (`by ...`).

## Resolution
Track resolution continues to use the existing Apple-to-YouTube matcher. Up to four requests may be resolved concurrently. Repeated title+artist pairs reuse the same in-flight/result promise to avoid duplicate provider calls in large playlists.

## Compatibility
Linked Apple playlists, Apple single-track import, YouTube track/playlist import, local storage, playback, and the AmpMusic 1.5 UI remain unchanged.
