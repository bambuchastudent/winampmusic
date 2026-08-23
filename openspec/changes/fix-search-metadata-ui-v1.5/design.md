# Design

## Search failover
The existing search card stays unchanged. Search continues to try the current trusted public Invidious instances first. If they all fail or return no usable videos, AmpMusic tries a small Piped API pool using the unauthenticated `/search?q=...&filter=videos` endpoint. Piped results are normalized to the same internal shape used by the current renderer.

The external YouTube link remains only as a final degradation path when both provider families are unavailable. Search never adds an API key, central backend, or account requirement.

## Metadata synchronization
The FAST player exposes a narrow `updateTrackMetadata(videoId, patch)` API. The existing oEmbed hydrator uses that API after resolving a pasted track. The update changes the in-memory library, persists localStorage, re-renders the current filter, and refreshes the now-playing text when needed.

This prevents a correctly playing track from remaining visible as `YouTube <videoId>` until a page reload.

## Empty state
The stylesheet explicitly defines `.empty-state[hidden]{display:none}`. The FAST renderer also keeps the DOM `hidden` flag synchronized with the filtered result count.

## Version ownership
The legacy `v059.js` search module must not write `.app-version` or install/replace release branding. The public shell remains AmpMusic 1.5 and owns its own favicon/version labels.

## Compatibility
Existing storage keys and runtime filenames remain unchanged. This is a 1.5 patch only.
