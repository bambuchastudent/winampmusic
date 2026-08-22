# Release branding specification

## Requirement: public version badge stays 1.5
The product MAY use technical patch versions such as `1.5.0`, `1.5.1` or later `1.5.x` internally, in source metadata, tags and diagnostics.

The primary user-visible release badge SHALL remain exactly `1.5` for the lifetime of the 1.5 release line.

### Scenario: patch release
- GIVEN a technical build version in the `1.5.x` line
- WHEN the canonical player renders
- THEN the prominent release badge SHALL display `1.5`
- AND SHALL NOT display the patch component.

## Requirement: AmpMusic bottle identity
The prominent `1.5` badge SHALL keep the existing lightweight CSS/HTML bottle mark rather than adding a new network image or redesigning the logo.

The mark SHALL visually include the existing bottle/lightning identity and release text `1.5`.

The product name SHALL be `AmpMusic`. Compatibility storage keys, import message names and repository paths MAY retain historical `winampmusic` identifiers.

### Scenario: critical startup
- WHEN the player starts on mobile
- THEN the bottle mark SHALL require no additional network request
- AND SHALL register no pointer/capture handlers
- AND SHALL not participate in playback logic.

## Requirement: no unapproved major-version advertising
The 1.5 production shell SHALL NOT display a `2.0` teaser or otherwise imply that a major version has been approved.

A public version change requires a separate explicitly approved OpenSpec change.

## Requirement: demo consistency
Release screenshots/story media SHALL keep the same AmpMusic + lightning/bottle + `1.5` identity unless a later approved branding spec changes it.
