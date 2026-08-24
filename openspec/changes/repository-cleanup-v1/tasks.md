# Tasks: repository cleanup v1

- [x] Inventory root, tests, OpenSpec, and GitHub Actions without deleting files.
- [x] Map current HTML startup scripts, lazy runtime modules, window/API compatibility paths, PWA files, tests, and workflows.
- [x] Record the `develop` baseline SHA and distinguish current targeted gates from pre-existing stale CI failures.
- [x] Classify candidates as keep, legacy-referenced, probable dead, safe delete, consolidation-later, or manual decision.
- [x] Create `cleanup/repository-dead-files` from the recorded `develop` baseline.
- [x] Add a repository-integrity behavioral contract for startup scripts, lazy JS targets, PWA/manifest assets, current critical scripts, Now Playing/import preservation, header branding, Share/QR, compatibility keys, and Pages inputs.
- [x] Add a dedicated GitHub Actions integrity gate using current targeted contracts.
- [ ] Remove only the first proven-dead file batch.
- [ ] Verify no runtime/test/workflow/PWA/build reference to removed filenames remains.
- [ ] Run the dedicated integrity gate and review targeted results.
- [ ] Report exact removed files and cleanup size in the pull request.
- [ ] Open a pull request to `develop` without merging it.
