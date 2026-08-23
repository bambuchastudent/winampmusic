# YouTube playlist paste import for AmpMusic 1.5

## Why
AmpMusic 1.5 already has one compact URL import field, but a pasted YouTube URL is currently treated as a single video even when it contains a playlist. The same field should understand the user's intent from the URL: track URL imports one track; playlist URL imports the playlist.

## Scope
- Keep the public product/version as AmpMusic 1.5.
- Keep a single import field and button; do not add a separate playlist form.
- Detect YouTube playlist URLs by their `list` parameter, including `watch?v=...&list=...` links.
- Resolve playlist video IDs through the existing YouTube IFrame API, with no new API key or backend.
- Import all resolved unique IDs into the existing local library and start the first playlist track.
- Hydrate imported track metadata in the background using the existing YouTube oEmbed path.
- Keep existing standalone YouTube-track and Apple Music-track import behavior.
- Apple Music playlist import remains outside this change.
