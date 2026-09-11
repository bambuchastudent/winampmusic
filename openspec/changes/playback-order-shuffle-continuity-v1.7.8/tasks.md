# Tasks — playback order/shuffle/continuity v1.7.8

- [x] Add a failing regression covering exact manual selection, sequential unresolved skipping, visible Shuffle state, and hidden-tab resume intent.
- [x] Add a lightweight navigation intent + Shuffle state adapter loaded before optional resolver/queue work.
- [x] Update queue recovery so manual unresolved selection resolves only the selected row while automatic continuation may skip unresolved rows.
- [x] Preserve `intendedPlaying` across provider-generated hidden-tab PAUSED transitions.
- [x] Cache the navigation runtime and bump the PWA build/cache revision.
- [ ] Run targeted CI and the complete behavioral suite.
- [ ] Merge to `develop` only after green CI and verify Pages deployment.
