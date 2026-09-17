# Proposal: YouTube embed retry v1.8.2

## Problem

A valid YouTube playback observation can still fail in the embedded player with error `101` or `150` when that particular upload forbids embedding. The track remains identifiable by title and artist, but playback currently stops at `YOUTUBE ERROR 150` even though another YouTube upload of the same recording may be playable.

## Goal

When the active YouTube iframe reports embed-denied error `101` or `150`, search for another YouTube video using the canonical track title and artist, skip playback IDs already tried for that recording, and retry playback without changing the track's canonical title, artist, origin, or Ámpula evidence.

## Scope

- Handle iframe errors `101` and `150` as recoverable playback-handle failures.
- Reuse browser-side Invidious search as a best-effort resolver for an alternate YouTube video ID.
- Keep attempted playback IDs in ephemeral runtime state to prevent loops.
- Retry through the existing `window.playIndex` path so queue/navigation ownership remains unchanged.
- Fail visibly and leave the track identity intact when no alternate candidate can be found.

## Non-goals

- No audio extraction or media-byte storage.
- No change to Ámpula Core.
- No provider metadata replacement.
- No dependency on a mandatory backend.
- No attempt to bypass browser or YouTube platform restrictions.

## Success criteria

1. Error `101` or `150` triggers alternate-handle resolution rather than a permanent dead end.
2. A failed YouTube ID is never selected again during the same recording's retry session.
3. Only the local playback handle (`track.id`) may change; `title`, `artist`, and origin metadata remain untouched.
4. When all candidates fail or resolver instances are unavailable, playback stops with a clear unavailable status and no retry loop.
