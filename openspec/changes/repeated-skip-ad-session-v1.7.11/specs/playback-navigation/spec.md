# Playback navigation delta v1.7.11

## Requirement: unresolved skip remains authoritative after runtime settles

The playback queue MUST remain the outer navigation authority after delayed diagnostics/pageshow bridge installation. Reinstall attempts MUST NOT stack duplicate queue or trusted-resolver wrappers.

### Scenario: skip still works after delayed bridge refresh
Given a current playable track, the next row is unresolved, and a later row is playable, when delayed diagnostic bridge refresh has already run and Next/ENDED requests the unresolved row, then queue recovery skips it and starts the later playable row instead of waiting on a long explicit trusted resolution path.

## Requirement: advertisements are shown as AD, not PAUSED

When YouTube wire data indicates that an advertisement is actively playing for the current final-trusted track, AMPULAMP MUST show `AD` as the main playback status even if the content player's normal state currently reads `PAUSED`. The compact ad countdown MAY remain alongside it.

## Requirement: one YouTube player per page session

Track changes MUST reuse the existing YouTube iframe/player instance for the lifetime of the page. Switching recordings uses the existing player and MUST NOT construct a new `YT.Player` per track.

This invariant does not imply any limit on YouTube's own ad decisions; YouTube may serve an advertisement for any individual video load.

## Requirement: identity remains canonical

Navigation, advertisement detection, and player-session reuse MUST NOT rewrite title, artist, origin metadata, or origin provider from a YouTube playback candidate.