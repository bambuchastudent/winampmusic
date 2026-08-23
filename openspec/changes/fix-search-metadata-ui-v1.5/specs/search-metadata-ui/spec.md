# Search and metadata UI requirements

## Search resilience
AmpMusic 1.5 SHALL keep the existing in-app YouTube search card and SHALL try more than one provider family before degrading to an external YouTube search link.

A successful fallback search result SHALL be normalized into the same title, artist, duration, thumbnail, and 11-character video ID fields used by existing search results.

## Metadata hydration
When a pasted YouTube track initially enters the library with placeholder metadata and oEmbed later returns a title or artist, AmpMusic SHALL update the active in-memory library, persistent localStorage, visible library row, and now-playing display without requiring a reload.

## Empty state
When the rendered library contains one or more tracks, the `No saved music` empty state SHALL NOT be visible.

## Version ownership
Lazy legacy helper modules SHALL NOT replace the public AmpMusic 1.5 version label or release branding.

## Version lock
These fixes SHALL ship as AmpMusic 1.5 and SHALL NOT introduce a new public version number.
