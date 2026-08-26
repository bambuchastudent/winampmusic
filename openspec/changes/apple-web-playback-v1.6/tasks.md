# Tasks

- [x] Document the false synthetic-ID / false-matched failure.
- [x] Define full-source semantics: MusicKit when configured, otherwise real resolver result; no preview-as-success.
- [x] Add `apple-resolution-v162.js` for strict full-source resolution of Apple track/album/playlist imports.
- [x] Preserve Apple evidence while storing a real YouTube handle only after successful resolution.
- [x] Migrate deterministic legacy Apple synthetic IDs to provider-independent local recording IDs.
- [x] Preserve the original YouTube iframe as fallback when direct/proxy playback fails.
- [x] Add regression coverage for partial album resolution, legacy migration, and iframe fallback.
- [x] Wire the regression into pull-request CI.
- [ ] Merge only after all existing and targeted checks are green.
- [ ] Verify the GitHub Pages deployment and retest the `200 по встречной` album URL on production.
