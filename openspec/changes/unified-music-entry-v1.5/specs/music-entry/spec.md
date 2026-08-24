# Capability: unified music entry

## Requirement: one primary music field
The player SHALL expose one primary visible text field for music discovery/import during normal use.

### Scenario: search by text
- GIVEN the player is ready
- WHEN the user enters an artist or track name in the primary music field
- THEN the existing music-search provider flow is used
- AND results appear beneath that same primary field
- AND no separate YouTube search input is visible.

### Scenario: import provider URL
- GIVEN the player is ready
- WHEN the user enters a supported YouTube or Apple Music track, album, or playlist URL
- THEN the existing provider import flow receives the URL
- AND its current add/play behavior is preserved.

## Requirement: optional local library filter
The player SHALL preserve local library filtering while keeping its text field hidden by default.

### Scenario: open library filter
- GIVEN the library filter is hidden
- WHEN the user activates the library search toggle
- THEN the local filter field becomes visible and receives focus.

### Scenario: close library filter
- GIVEN the local filter field is visible
- WHEN the user closes the library search toggle
- THEN the field is hidden
- AND its query is cleared
- AND the full local library is rendered again.

## Requirement: FAST core remains independent
Failure to load remote-search UI or providers SHALL NOT block playback controls, saved-library rendering, or provider URL import.
