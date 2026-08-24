# Ámpula product branding requirements

This change supersedes the `AmpMusic` public-name requirement in `openspec/changes/release-v1.5.0/specs/release-branding/spec.md`. The existing 1.5 version-lock and lightweight bottle/lightning requirements remain in force.

## Requirement: project identity

The project SHALL be named **Ámpula**.

The portable musical moment SHALL continue to be represented as a `.ampula` file containing the ordered selection and enough source/identity context for later recovery.

### Scenario: contributor enters the repository
- WHEN a human or coding agent reads the current repository guidance
- THEN the project SHALL be identified as `Ámpula`
- AND the `.ampula` concept SHALL remain provider-independent.

## Requirement: player identity

The music player application SHALL be named **ÁmpulaMP**.

`MP` SHALL mean **Music Player**.

### Scenario: user opens or installs the player
- WHEN the canonical production shell or PWA metadata is shown
- THEN the application name SHALL be `ÁmpulaMP`
- AND `AmpMusic`, `Winamp Music`, and `Ámpulamp` SHALL NOT be presented as the current player name.

## Requirement: user-facing integration branding

Media Session fallback branding, system playlist sharing text, QR onboarding copy, browser metadata, and logo accessibility metadata SHALL use **ÁmpulaMP** where an application/player name is required.

### Scenario: playlist is shared
- WHEN the user invokes system sharing or displays the playlist QR flow
- THEN the receiving copy SHALL identify the player as `ÁmpulaMP`.

## Requirement: release identity remains 1.5

This naming change SHALL NOT introduce a new public version number. The prominent release badge SHALL remain `1.5`, and the current lightweight bottle/lightning identity SHALL remain part of the production shell.

### Scenario: renamed production shell
- WHEN ÁmpulaMP renders
- THEN the badge SHALL display `1.5`
- AND the branding change SHALL add no critical-path network request.

## Requirement: compatibility identifiers remain stable

Historical implementation identifiers MAY retain `winampmusic`, `WINAMP_MUSIC`, `AMP_MUSIC`, or similar legacy tokens when changing them could break stored libraries, importers, state restoration, or runtime compatibility.

In particular, this change SHALL NOT require migration of existing `winampmusic.*` localStorage keys or `WINAMP_MUSIC_IMPORT` messages.

### Scenario: existing user opens renamed player
- GIVEN an existing library stored under the current compatibility keys
- WHEN the renamed player loads
- THEN the same library SHALL remain available without migration or reset.

## Requirement: provider independence remains unchanged

Renaming SHALL NOT make a provider URL or service ID the identity of an Ámpula or proof of playability. Creation and later playback MAY resolve through different available sources.
