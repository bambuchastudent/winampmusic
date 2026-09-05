# FAST runtime specification delta

## Requirement: Core controls are available before optional work
The application SHALL make Play, Previous, Next, Shuffle, library track selection, and local filtering interactive before optional network-backed features are loaded.

### Scenario: Saved large library
- GIVEN a saved library of 183 tracks
- WHEN the application starts
- THEN no more than the initial render batch is synchronously inserted
- AND Play/Next/track selection SHALL already work
- AND optional share, QR, background, lyrics, comments, and legacy recovery modules SHALL NOT be required for those controls.

## Requirement: Optional features cannot own core interaction events
Optional modules SHALL NOT use document-level capture/pointer interception to replace or block native core control handlers.

### Scenario: Optional module is present
- GIVEN the core player handlers are installed
- WHEN an optional module loads
- THEN a normal click/tap on a core control SHALL continue to reach the core handler exactly once.

## Requirement: Playlist gifting is lazy
The application SHALL expose `Gift / QR` without loading share or QR implementation during normal startup.

### Scenario: User does not share
- WHEN the player starts and the user only plays music
- THEN compact share and QR implementation SHALL remain unloaded.

### Scenario: User gifts playlist
- WHEN the user activates `Gift / QR`
- THEN compact sharing SHALL load on demand
- AND QR rendering SHALL load only as part of the share flow
- AND the resulting share SHALL represent the whole saved playlist.

## Requirement: Shared playlist import is non-destructive
Opening a valid shared playlist SHALL merge tracks into the recipient library and SHALL NOT delete unrelated existing tracks.

## Requirement: Playlist clear is explicit
Clearing the playlist SHALL require two distinct user actions within a short confirmation window.

### Scenario: Accidental first tap
- WHEN the user taps `Clear` once
- THEN the playlist SHALL remain unchanged
- AND the action SHALL change to an explicit confirmation state.

### Scenario: Confirmed clear
- WHEN the user confirms within the allowed window
- THEN ÁmpulaMP playlist/current-playback state SHALL be removed
- AND unrelated site/browser data SHALL remain untouched.
