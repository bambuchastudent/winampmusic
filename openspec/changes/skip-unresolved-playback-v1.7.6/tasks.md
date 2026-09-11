# Tasks — skip unresolved playback v1.7.6

- [x] Define Next/ENDED skip semantics and current-row exclusion.
- [x] Add regression covering current → unresolved → later playable, including delayed readiness.
- [x] Implement direction-aware recovery that excludes the current row.
- [x] Bump runtime/cache wiring and keep existing trust contracts green.
- [ ] Merge after CI and verify Pages deployment.
