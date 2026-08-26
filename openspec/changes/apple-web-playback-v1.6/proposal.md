# Apple-origin full playback resolution v1.6

## Problem

Apple Music imports preserve useful catalog metadata, but the deployed player has no MusicKit developer credentials. The catalog-first adapter also encoded Apple song IDs into synthetic 11-character values, which generic playback logic mistook for YouTube IDs. That produced false results such as `12 matched` followed by `NO PLAYABLE SOURCE`.

Apple's public 90-second preview is not an acceptable normal playback result for AMPULAMP: the user wants the complete recording.

## Goal

Make Apple Music imports resolve to honest, full-length playback sources while preserving Apple catalog evidence separately from the current playback handle.

## Scope

- Apple catalog IDs remain in `appleTrackId` / Apple observations and never become generic playable IDs.
- A track is counted as playable/matched only when a real current playback source was resolved.
- Apple track, album, and playlist imports attempt strict YouTube resolution for full-length fallback playback.
- MusicKit remains the preferred Apple-native full playback path when a valid deployment configuration exists.
- Without MusicKit credentials, a resolved YouTube source can play completely inside AMPULAMP.
- If direct/proxy audio for a resolved YouTube source fails, the original YouTube iframe player remains a full-track fallback.
- Previously stored synthetic Apple IDs are migrated to provider-independent local recording IDs before another resolution attempt.
- Unresolved recordings remain in the library with their title, artist, order, and Apple evidence.

## Non-goals

- Using 90-second Apple previews as normal playback.
- Bypassing Apple authentication, DRM, subscriptions, or MusicKit requirements.
- Hard-coding provider IDs for one particular album.
- Treating YouTube or Apple identifiers as canonical Ámpula track identity.

## Success criteria

1. An Apple album with 12 readable tracks never reports `12 matched` merely because all 12 have Apple catalog IDs.
2. Real YouTube resolver results are stored as playback handles and can play the complete recording in AMPULAMP.
3. A direct-audio failure for an already resolved YouTube handle falls back to the YouTube iframe instead of ending at `NO PLAYABLE SOURCE`.
4. Unresolved tracks are preserved without fabricated YouTube IDs.
5. Existing libraries containing the old synthetic Apple IDs are migrated automatically.
