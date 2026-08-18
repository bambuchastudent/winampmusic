# Share routing specification

## Requirement: Playlist shares return to Winamp Music
Every user-facing playlist share destination SHALL be a Winamp Music site URL.

### Scenario: Compact remote share succeeds
- GIVEN a playlist can be stored using the compact remote share service
- WHEN the user activates `Gift / QR`
- THEN the visible link SHALL use the Winamp Music site origin
- AND the remote share id/key SHALL be embedded into that site URL
- AND the QR code SHALL encode exactly that site URL
- AND the system share payload SHALL use exactly that site URL.

### Scenario: Remote share falls back
- GIVEN the remote share service is unavailable
- WHEN the app builds a local fallback share
- THEN the fallback SHALL still use the Winamp Music site origin
- AND the QR/system/copy destinations SHALL remain identical.

## Requirement: Story media is not a dead end
A v1.5.0 release/demo story asset SHALL visibly route viewers to Winamp Music even if the social platform strips share metadata.

### Scenario: Story video is viewed without clickable metadata
- GIVEN the story video has been uploaded as media only
- WHEN a viewer watches it
- THEN a readable Winamp Music URL SHALL be visible in the video
- AND a scannable QR code SHALL be visible
- AND both SHALL target the canonical Winamp Music site or the intended playlist share URL.

### Scenario: Platform accepts URL metadata with media
- WHEN the system share API accepts both media and URL metadata
- THEN the app SHALL pass the same Winamp Music URL used by the QR code.

## Requirement: Sharing does not enter the critical startup path
Share generation, QR generation, and story/demo preparation SHALL NOT block first paint, core controls, local playlist rendering, or initial YouTube player readiness.
