# Design: local playback continuity v1.6

## Principle

Playback position is part of local listening memory, not part of the transport/provider identity. The checkpoint belongs to the local player runtime and references the active musical context and intended track.

## Local checkpoint

Use a versioned local record, conceptually:

```json
{
  "v": 1,
  "context": {
    "kind": "library | saved-ampula | received-ampula",
    "id": "stable-local-context-id"
  },
  "track": {
    "key": "stable-track-key",
    "title": "...",
    "artist": "..."
  },
  "positionMs": 197000,
  "durationMs": 241000,
  "wasPlaying": true,
  "updatedAt": "2026-08-25T11:00:00.000Z"
}
```

`track.key` MUST be stable across list reordering. A provider-specific ID may be stored as a source hint, but MUST NOT be the only semantic identity available to recovery.

## Persistence cadence

- Save immediately when the current track/context changes.
- While playing, checkpoint periodically at a bounded cadence (target 2–5 seconds; do not write every animation/progress tick).
- Save on pause and explicit seek.
- Save on `pagehide` and when the document becomes hidden where practical.
- Avoid unbounded history growth: this change needs only the latest checkpoint per active context.

## Restore flow

1. Load local library/saved Ámpula metadata first.
2. Read the checkpoint.
3. Resolve the checkpoint context.
4. Resolve the intended track by stable key/identity, not list index.
5. Render that track as current immediately.
6. Prepare the applicable playback adapter.
7. Seek to `positionMs` once duration/source metadata is ready.
8. Keep the session paused/ready unless a browser-approved continuation path exists; the next Play action starts from the restored position.

## YouTube adapter

The YouTube player MUST use `loadVideoById`/`cueVideoById` with a start offset or seek after readiness. It MUST NOT blindly call the existing zero-offset path during restore.

## Direct-audio adapter

The direct `Audio` path currently sets `currentTime = 0` when a source is prepared. Restore mode MUST instead wait for metadata/readiness and assign the checkpoint position before playback.

## Failure modes

- Missing context: ignore the checkpoint without mutating user data.
- Missing track in the current context: keep the context intact, show no destructive fallback, and allow normal track recovery/resolution if identity metadata is sufficient.
- Position greater than duration: clamp to a safe point within the track.
- Very old/stale checkpoint: still restore unless its referenced context no longer exists; `updatedAt` is diagnostic, not an expiry timer.
- Source changed: resolve a playable source for the intended track, then apply the position to the resolved source.

## Compatibility

The existing `winampmusic.fast.current.v1` numeric-index key is insufficient as the source of truth. It may be read during migration if useful, but the new checkpoint becomes authoritative for continuity. New code MUST NOT depend on list position remaining stable.

## Privacy

Checkpoint state remains in local browser storage. No playback position is uploaded as part of sharing unless a future spec explicitly defines that behavior.
