# Proposal: local playback continuity v1.6

## Problem

ÁmpulaMP currently remembers parts of the local library state, but a page reload loses the actual listening position. The selected track may also fail to resume as a playable current item even when its list index was persisted.

A local-first music player should remember where the listener was. Reloading the page, reopening the PWA, or returning after the browser discards the tab must not reset the musical moment to the beginning.

## Goal

Persist a local playback checkpoint that restores the same listening context, same track, and same elapsed position after a reload/reopen without requiring any backend.

## Scope

- Persist the active playback context locally.
- Persist stable track identity, not only a mutable list index.
- Persist elapsed playback position.
- Restore UI and player source to that checkpoint after reload.
- Restore in a paused/ready state when browser autoplay rules prevent or make automatic playback undesirable.
- Continue from the restored position on the next Play action.
- Support both YouTube-backed playback and direct audio playback.
- Make the checkpoint context-aware so Library, Saved Ámpula, and Received Ámpula sessions cannot overwrite each other incorrectly.
- Keep writes cheap and bounded.

## Non-goals

- Cross-device playback synchronization.
- Cloud accounts or a centralized playback-history service.
- Exact sample-perfect continuation.
- Bypassing browser autoplay restrictions.
- Treating provider URLs or provider IDs as the identity of the musical moment.

## Success criteria

1. If a listener is at 03:17 of a track and reloads the page, ÁmpulaMP restores that same track at approximately 03:17.
2. Restoring does not depend on the track remaining at the same numeric list index.
3. A restored session does not automatically alter the local library or saved Ámpula contents.
4. The same behavior works for YouTube and direct-audio playback paths.
5. If the saved source is no longer usable, the checkpoint still identifies the intended track so normal resolution/recovery can run.
6. All checkpoint data remains local to the browser/device.
