# Background playback specification delta

## Requirement: Background integration is optional and lazy
The application SHALL become interactive before background/media-session code is loaded.

### Scenario: Normal startup
- GIVEN a saved library
- WHEN the page starts
- THEN core Play/Prev/Next/track selection SHALL work before the background module is loaded
- AND the background module SHALL NOT participate in synchronous startup.

## Requirement: System media controls reuse core controls
When Media Session is supported, system play, pause, previous and next actions SHALL invoke the existing FAST control actions and SHALL NOT replace their event handlers.

## Requirement: Current playback state is resumable
The application SHALL persist the selected track, elapsed position and whether playback was intended to continue when the page becomes hidden or is suspended.

### Scenario: Browser suspends embedded playback
- GIVEN a track was playing
- WHEN the browser or OS suspends the page/media
- THEN the app SHALL preserve a resume snapshot
- AND when the page becomes active again it SHALL allow the same track to resume from the saved position without corrupting the playlist.

## Requirement: Embedded player geometry is supported
The YouTube player SHALL use an offscreen but at least 200x200 iframe viewport and SHALL remain non-interactive to the user.

## Requirement: Background failure cannot break foreground playback
If Media Session is unavailable, partially implemented, or throws, the FAST Play/Prev/Next/track controls SHALL continue to work normally.
