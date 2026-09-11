# Tasks: rolling playback queue v1.7.0

- [x] Define two-playable-ahead queue semantics.
- [x] Preserve strict resolver rejection for untrusted duration/title/artist matches.
- [x] Keep successful YouTube resolutions in persistent cache and FAST live playback state.
- [x] Skip unresolved rows only during automatic end-of-track rollover.
- [x] Keep manual unresolved selection fail-closed.
- [x] Add compact right-side `AD mm:ss` indicator beside `PLAYING`.
- [x] Add focused regressions for queue rollover, cache reuse, manual failure, and ad UI.
- [ ] Run required CI and merge only when green.
- [ ] Verify Pages deployment and stamped revision.