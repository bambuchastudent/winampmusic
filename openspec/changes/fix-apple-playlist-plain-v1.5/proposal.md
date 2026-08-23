# Proposal: fix Apple playlist plain-row parsing in AmpMusic 1.5

## Problem
Some public Apple Music playlists are rendered by the public reader as a plain tabular text stream rather than Markdown links. The current AmpMusic 1.5 importer only recognizes linked `/song/.../<id>` entries, so a valid playlist can be detected but produce zero readable tracks.

Regression URL: `https://music.apple.com/tr/playlist/favourite-songs/pl.u-BpUq1XGL0`.

## Change
Keep the existing public Apple playlist import flow, but add a second parser for the plain `Song / Artist / Album / Time` table shape. Preserve the linked parser as the preferred path and keep version 1.5, the existing UI, and the existing local YouTube resolver.

## Scope
- Parse the supplied public playlist shape.
- Preserve song order, artist, album, and preview duration.
- Keep linked Apple playlists working.
- Keep one unresolved match from aborting the whole playlist.
- Improve large-playlist matching throughput with bounded concurrency and duplicate-query reuse.
