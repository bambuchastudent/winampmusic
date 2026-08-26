# Apple web playback capability delta

## Requirement: Apple catalog identity MUST NOT masquerade as a generic playable ID

An Apple catalog track MUST store its Apple catalog identifier in `appleTrackId`. The generic playback `id` MUST be absent unless a resolver has produced a real runtime-playable handle.

### Scenario: album metadata only

Given an Apple Music album track with a numeric Apple catalog ID
And no successful YouTube resolver result
When AMPULAMP imports the track
Then the saved track has `appleTrackId`
And the saved track does not have a fake 11-character YouTube-like `id`
And the track remains visible and searchable.

## Requirement: matched MUST mean resolved playback

Catalog metadata availability MUST NOT increment the import `matched` count.

### Scenario: twelve Apple tracks, zero resolver matches

Given an album with 12 readable Apple catalog tracks
And zero real YouTube resolver matches
When import completes
Then `total` is 12
And `matched` is 0
And the status does not claim `12 matched`.

## Requirement: explicit Play MAY hand off to Apple Music web

When MusicKit is unavailable, an Apple-origin track with a valid `music.apple.com` track URL MUST remain playable by explicit browser handoff.

### Scenario: user taps Play

Given an Apple-origin track with `appleTrackUrl`
And MusicKit is not configured
And no in-player resolver handle is available
When the user explicitly taps Play or the track row
Then AMPULAMP opens the exact Apple Music URL in browser context
And does not label the track `NO PLAYABLE SOURCE` before that handoff.

### Scenario: import requests autoplay

Given the same track
When import completes with `play: true` but without a user Play gesture
Then AMPULAMP MUST NOT open a popup or navigate away automatically.

## Requirement: existing fallback resolution remains valid

### Scenario: real YouTube match exists

Given an Apple-origin track with a resolver-produced real YouTube video ID
When Play is requested
Then AMPULAMP may play that source in-player
And the track counts as matched.
