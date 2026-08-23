# Apple Music plain playlist import

## Requirement: public plain-table playlists are importable
AmpMusic 1.5 SHALL import a public Apple Music playlist when the public reader exposes tracks as a plain `Song / Artist / Album / Time` table instead of Markdown song links.

### Scenario: supplied Favorite Songs playlist
Given `https://music.apple.com/tr/playlist/favourite-songs/pl.u-BpUq1XGL0`, when the reader returns plain rows, the importer SHALL extract the playlist name, ordered track titles, artists, albums, and durations and SHALL pass those tracks to the existing YouTube resolver.

### Scenario: linked playlist compatibility
When the reader returns linked Apple Music song entries, the existing linked parser SHALL continue to be used without changing the public AmpMusic 1.5 UI or version.

### Scenario: partial resolution
If one track cannot be resolved on YouTube, the remaining successful tracks SHALL still be imported in Apple playlist order.
