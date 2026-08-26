# Proposal: Cross-provider playback resolution

## Problem

AMPULAMP can know a recording and even resolve a YouTube candidate while still showing `NO PLAYABLE SOURCE IN AMP` for an Apple-origin track. The current direct-playback bridge writes a newly resolved YouTube id to `localStorage`, but the FAST player keeps a separate in-memory library. If direct Piped audio then fails and playback falls back to the YouTube iframe, the core can still see the stale pre-resolution id and tries to resolve the track again.

That violates the Ámpula resolver contract: origin is historical evidence, not a playback constraint, and a current playable representation found on another provider must be usable immediately.

## Goal

Make a successful receiver-side resolution authoritative for the working player state before any fallback playback runs. Apple Music origin/storefront metadata must remain untouched while the resolved YouTube representation is adopted as local mutable playback state.

## Scope

- Add one core operation for adopting a validated resolved YouTube playback handle into the in-memory working library.
- Make direct Apple-origin playback use that operation instead of mutating a separate `localStorage` snapshot.
- If direct Piped audio is unavailable after resolution, fall back to the YouTube iframe with the already-resolved id.
- Keep title, artist, Apple origin URL, storefront evidence, Apple track id and badges intact.
- Add a regression test using Cyrillic metadata matching the reported failure shape.

## Non-goals

- Changing Ámpula Core v1 or writing resolver state into a received Ámpula.
- Requiring Apple Music, YouTube, Piped, Invidious or any centralized backend as format identity.
- Treating a catalog/import match as proof that audio has started.
- Replacing the existing strict matcher or changing its confidence rules.

## Success criteria

1. An Apple-origin recording resolved to a valid YouTube id stores that id in both the authoritative in-memory library and persistent working-library state.
2. A Piped/direct-audio failure after that resolution falls back to `loadVideoById` with the resolved id, without a second stale lookup.
3. Apple origin metadata remains unchanged after cross-provider resolution.
4. Cyrillic title/artist metadata can pass through the existing strict matcher and the regression scenario stays covered.
5. Existing origin/provenance, unresolved-track, Apple import and FAST player contracts remain green.
