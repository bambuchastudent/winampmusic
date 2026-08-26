# Apple web playback fallback v1.6

## Problem

Apple Music album imports can preserve correct catalog metadata while the deployed AMPULAMP site has no MusicKit developer credentials. The current catalog-first adapter creates an 11-character synthetic `id` for Apple catalog tracks. Generic playback code mistakes that value for a YouTube video ID, the import UI can report those tracks as `matched`, and playback ends in `NO PLAYABLE SOURCE` even though the original Apple Music track is playable in the user's browser.

## Goal

Treat Apple Music browser playback as a valid provider playback path without confusing Apple catalog identity with a YouTube playback handle.

## Scope

- Apple album/playlist/track entries keep Apple catalog IDs in `appleTrackId`, not in the generic playable `id` field.
- `matched` means a real playable resolver result, never merely the presence of Apple catalog metadata.
- When MusicKit is not configured and an Apple track has an Apple Music URL, an explicit user Play action hands playback to that exact Apple Music web URL instead of reporting the track as unplayable.
- Automatic import must not create popup windows; browser handoff happens only from an explicit user gesture.
- Existing YouTube fallback resolution remains available when it succeeds.

## Non-goals

- Bypassing Apple authentication, DRM, subscription, or MusicKit requirements.
- Controlling playback inside music.apple.com after browser handoff.
- Treating provider IDs as canonical Ámpula identity.

## Success criteria

1. Importing an Apple album with 12 readable catalog tracks and zero resolved YouTube sources reports 12 tracks, 0 matched, 12 Apple/web-capable tracks (or equivalent non-misleading wording), and does not create fake YouTube IDs.
2. Pressing Play on such a track when MusicKit is unavailable opens the exact Apple Music track URL in the browser.
3. Import-time autoplay does not trigger browser handoff/popups.
4. A real resolved YouTube ID is still counted as matched and can play inside AMPULAMP.
