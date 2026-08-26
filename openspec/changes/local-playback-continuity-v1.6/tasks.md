# Tasks: local playback continuity v1.6

## First slice — Library continuity

- [x] Add targeted tests for restoring the same track and elapsed position after reload.
- [x] Add a versioned local playback checkpoint keyed by playback context and stable track identity.
- [x] Replace numeric-index-only restore semantics with stable track resolution for Library resume.
- [x] Persist checkpoints on seek, pause/ready state, bounded playback cadence, and page hide.
- [x] Restore YouTube playback at the saved offset on the next explicit playback gesture.
- [x] Restore direct-audio playback at the saved offset through the shared seek contract on the next explicit playback gesture.
- [ ] Restore Library, Saved Ámpula, and Received Ámpula contexts without cross-mutation. Library is implemented; Saved/Received remain.
- [x] Add tests for list reorder between checkpoint and restore; stable identity no longer depends on the old index.
- [x] Add tests for autoplay-blocked/paused restore: correct track and position remain ready until explicit Play.
- [ ] Add tests for replacement-source recovery retaining the saved elapsed position.
- [ ] Remove the old numeric index as authoritative continuity state after migration.

## Follow-up acceptance

The remaining slice must make Saved Ámpula and Received Ámpula first-class playback contexts and then retire the legacy numeric current-index key as continuity authority. Provider/source replacement must get a dedicated behavioral regression before this change is complete.
