# Design — Apple web playback fallback v1.6

## Architecture

Apple provider identity and playback handles remain separate:

- `appleTrackId` / `appleTrackUrl` are Apple provider observations and browser-handoff data.
- generic `id` is populated only when a resolver has produced a real playable handle understood by the current runtime (currently a real YouTube video ID for this path).
- title/artist remain the recording identity used by the working library and Ámpula resolver.

## Playback order

For an Apple-origin track:

1. If MusicKit is configured, try MusicKit in-player playback.
2. If a real YouTube resolver handle already exists, use the existing in-player direct/YouTube path.
3. On an explicit user Play/track click, if Apple has an exact web URL, hand off to `music.apple.com` in the browser.
4. If none of those paths is available, keep the track unresolved and visible.

Automatic import/play requests do not perform browser handoff because popup/navigation behavior must require an explicit user gesture.

## UI semantics

`matched` is reserved for a resolver result that the runtime can actually attempt to play in-player. Reading Apple catalog metadata is reported separately and never increments `matched` by itself.

## Compatibility

Existing stored Apple entries with synthetic `Axxxxxxxxxx` IDs are normalized at playback/import boundaries by recognizing Apple-origin metadata and refusing to treat synthetic Apple IDs as YouTube IDs. Newly imported Apple catalog entries no longer generate those IDs.

## Failure modes

- Popup blocked: show a concise `OPEN APPLE MUSIC`/browser-handoff status and keep the track in the library.
- Missing `appleTrackUrl`: continue to resolver fallback and unresolved state.
- MusicKit unavailable: do not label the Apple track unplayable before considering browser handoff.
- Browser Apple page itself cannot play due region/account/subscription: that remains an Apple-side playback outcome; AMPULAMP preserves the source URL and metadata.

## Critical-path constraint

No Apple browser-handoff module is added to synchronous startup. The change stays inside already-loaded Apple playback/import adapters.
