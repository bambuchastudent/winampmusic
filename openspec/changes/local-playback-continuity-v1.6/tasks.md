# Tasks: local playback continuity v1.6

- [ ] Add targeted tests for restoring the same track and elapsed position after reload.
- [ ] Add a versioned local playback checkpoint keyed by playback context and stable track identity.
- [ ] Replace numeric-index-only restore semantics with stable track resolution.
- [ ] Persist checkpoints on track change, seek, pause, bounded playback cadence, and page hide.
- [ ] Restore YouTube playback at the saved offset.
- [ ] Restore direct-audio playback at the saved offset instead of forcing `currentTime = 0`.
- [ ] Restore Library, Saved Ámpula, and Received Ámpula contexts without cross-mutation.
- [ ] Add tests for list reorder/insert/remove between checkpoint and restore.
- [ ] Add tests for autoplay-blocked restore: correct track/position, paused and ready.
- [ ] Add tests for replacement-source recovery retaining the saved elapsed position.
- [ ] Remove the old numeric index as authoritative continuity state after migration.
