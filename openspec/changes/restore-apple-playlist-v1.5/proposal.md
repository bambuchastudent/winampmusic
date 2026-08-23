# Restore Apple Music playlist import in AmpMusic 1.5

## Problem
The current AmpMusic 1.5 import router detects public Apple Music playlist URLs but stops with a placeholder instead of importing them. This is a regression from the product expectation that a shared playlist link can be pasted into the same import field and listened to through local YouTube resolution.

## Goal
Pasting a public Apple Music playlist URL into the existing Music Import field SHALL import the playlist tracks into the local AmpMusic library, preserve playlist order where possible, resolve playable YouTube matches locally in the client, and start the first successfully resolved track.

## Constraints
- Keep public version 1.5.
- Keep the existing single import field and current UI.
- No Apple Music account login is required for a public shared playlist.
- Do not centralize user music or require an AmpMusic backend.
- Existing Apple Music single-track and YouTube track/playlist behavior must remain intact.
- Use the shared Apple Music URL as source context, not as the playback source of truth.
