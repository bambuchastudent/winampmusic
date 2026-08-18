# Release branding specification

## Requirement: Public version badge stays 1.5
The product MAY use technical patch versions such as `1.5.0`, `1.5.1` or later `1.5.x` internally, in source metadata, tags and diagnostics.

The primary user-visible release badge SHALL remain exactly `1.5` for the lifetime of the 1.5 release line.

### Scenario: patch release
- GIVEN a technical build version in the `1.5.x` line
- WHEN the canonical player renders
- THEN the prominent release badge SHALL display `1.5`
- AND SHALL NOT display the patch component.

## Requirement: Bottle identity
The prominent `1.5` badge SHALL be rendered as a lightweight CSS/HTML bottle mark rather than a network image so it cannot delay startup.

The mark SHALL visually include:
- a transparent plastic soda bottle silhouette;
- visible soda/bubbles;
- a Winamp label treatment;
- a lightning motif;
- the large release text `1.5`.

### Scenario: critical startup
- WHEN the player starts on mobile
- THEN the bottle mark SHALL require no additional network request
- AND SHALL register no pointer/capture handlers
- AND SHALL not participate in playback logic.

## Requirement: Demo consistency
The same visible `1.5` identity SHALL be used in release screenshots/story video so patch releases remain visually recognizable as the 1.5 line.
