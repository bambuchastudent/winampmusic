# Design

## Primary entry
The existing FAST import form remains the owner of provider URL import so Apple Music and YouTube URL behavior stays unchanged. A lightweight adapter changes the field to a search-capable text input and intercepts only non-URL submissions during the capture phase.

For normal text, the adapter loads/reuses the existing `v059.js` search module and submits the query through its provider failover logic. Search results are rendered below the primary input. For URL-like input, the adapter does not intercept the event; the existing FAST import handler receives it unchanged.

## Separate YouTube card
`v059.js` may still mount its legacy search DOM because it owns the search result renderer. The adapter keeps that panel hidden and moves only the results node into the main music-entry card. This preserves the existing provider/search implementation without showing a second input.

## Local library filter
The existing `#search` field remains wired to the FAST player's local filter. It is hidden on startup. A small search-icon button near `Your library` toggles the field. Closing the filter clears its text and dispatches an input event so the full library is restored.

## Compatibility
- Existing storage keys remain unchanged.
- Existing provider URL import code remains unchanged.
- Existing search provider failover remains unchanged.
- Playback controls and library rendering remain on the FAST critical path; the adapter is UI-only and the provider search module is still lazy.

## Failure modes
If the optional search module cannot load, URL import and playback remain available. The primary hint reports search unavailability without blocking the core player.
