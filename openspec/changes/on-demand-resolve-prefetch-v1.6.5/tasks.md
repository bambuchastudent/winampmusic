# Tasks: On-demand playback resolution with two-track prefetch v1.6.5

- [x] Remove automatic whole-playlist YouTube resolution from normal Spotify import.
- [x] Preserve the existing explicit `resolveInBackground()` compatibility API.
- [x] Add a non-blocking playback wrapper that prefetches the next two unresolved known-origin tracks.
- [x] Reuse the shared hardened YouTube matcher and existing trust marker.
- [x] Synchronize successful prefetched ids into FAST live state and local storage.
- [x] Load prefetch only after the v1.6.4 trusted playback bridge.
- [x] Add behavioral coverage for zero matcher calls on metadata-only import.
- [x] Add behavioral coverage for a moving two-track prefetch window.
- [x] Keep canonical Spotify/Apple title and artist after prefetch resolution.
- [ ] Verify CI, release gate and Pages deploy after merge.