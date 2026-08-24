# Tasks: repository cleanup v1

- [x] Inventory root, tests, OpenSpec, and GitHub Actions without deleting files.
- [x] Map current HTML startup scripts, lazy runtime modules, window/API compatibility paths, PWA files, tests, and workflows.
- [x] Record the `develop` baseline SHA and distinguish current targeted gates from pre-existing stale CI failures.
- [x] Classify candidates as keep, legacy-referenced, probable dead, safe delete, consolidation-later, or manual decision.
- [x] Create `cleanup/repository-dead-files` from the recorded `develop` baseline.
- [x] Add a repository-integrity behavioral contract for startup scripts, lazy JS targets, PWA/manifest assets, current critical scripts, Now Playing/import preservation, header branding, Share/QR, compatibility keys, and Pages inputs.
- [x] Add a dedicated GitHub Actions integrity gate using current targeted contracts.
- [x] Remove only the first proven-dead file batch (`fast-import-v142.js`).
- [x] Verify no runtime/test/workflow/PWA/build reference to the removed filename remains.
- [x] Run the dedicated integrity gate: syntax, repository graph, Now Playing/header, unified entry, Share/QR, Apple provenance, and current import routing all pass.
- [x] Report the exact removed file and cleanup size in pull request #73.
- [x] Open draft pull request #73 to `develop` without merging it.
