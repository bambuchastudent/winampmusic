# Proposal: rename the project to Ámpula and the player to ÁmpulaMP

## Problem

The repository currently exposes several overlapping names: `AmpMusic`, `Winamp Music`, and `Ámpulamp`. The maintainer has chosen the final naming model:

- **Ámpula** is the project / portable musical-moment concept.
- **ÁmpulaMP** is the music player (`MP` = Music Player).
- **`.ampula`** remains the portable file used to pass a musical moment and its ordered tracks.

Leaving old public names in the shell, PWA metadata, sharing UI, or contributor instructions makes the product identity ambiguous.

## Goal

Make Ámpula / ÁmpulaMP the canonical public naming everywhere that users, contributors, or coding agents are expected to read it, while preserving runtime compatibility and the existing 1.5 behavior.

## Scope

- README and agent instructions.
- OpenSpec workflow title and a new branding contract.
- Browser title, description, visible header, bottle label, and accessibility label.
- PWA manifest name/description.
- Media Session fallback album branding.
- Playlist system-share and QR explanatory text.
- Logo accessibility label.
- Branding contract test.

## Non-goals

- No version bump; the public release badge stays `1.5`.
- No redesign of the existing bottle/lightning visual identity.
- No playback/import/storage behavior changes.
- Do not rename existing `winampmusic.*` localStorage keys, `WINAMP_MUSIC_IMPORT` compatibility messages, or legacy internal JS flags; changing them would risk breaking existing libraries/importers.
- The GitHub repository slug / Pages path is infrastructure and may remain `winampmusic` until it is renamed separately in repository settings.

## Success criteria

1. The project is documented as **Ámpula**.
2. The installed/browser player is named **ÁmpulaMP**.
3. Current user-facing production shell, PWA metadata, Media Session fallback branding, and share/QR copy do not advertise `AmpMusic`, `Winamp Music`, or `Ámpulamp` as the product/player name.
4. `.ampula` semantics and provider-independent recovery rules remain unchanged.
5. Existing local libraries and import compatibility identifiers continue to work unchanged.
6. A targeted automated branding test encodes these requirements.
