# Tasks: repository cleanup v2

- [x] Re-audit `develop` at baseline `4557e7f`: inventory root, tests, OpenSpec, workflows, PWA files.
- [x] Compute transitive reachability from `index.html`, `sw.js`, `manifest.webmanifest`, and the public standalone pages.
- [x] Map `window.*` assignments, dynamic `script.src` loaders, `loadScript` markers, `defineProperty` interceptors, service-worker precache, and manifest assets.
- [x] Classify every candidate as keep, legacy-referenced, probable dead, safe delete, consolidate-later, or manual decision.
- [x] Record which CI contracts are current and which are stale, so stale failures are not treated as runtime defects.
- [x] Repair the three stale test contracts and gate the Pages deploy behind the suite.
- [x] Batch 1: remove the lyrics/comments cluster, referrer before target.
- [x] Batch 1: append all six filenames to the removal ledger.
- [x] Batch 2: remove the three stale branding contracts that contradict the current branding assertion.
- [x] Batch 2: wire the two passing, previously unreferenced branding contracts into CI.
- [x] Add a repository ignore file so local tool/IDE artifacts stay untracked.
- [x] Verify after each batch: syntax, repository integrity, startup graph, lazy targets, service worker, manifest, Now Playing/import guard, Apple provenance, Share/QR, shared receiver, background, header branding.
- [x] Confirm public recovery/fallback entrypoints still resolve.
- [ ] Open a pull request to `develop` and merge only after the gates pass.

## Deferred by explicit decision
- `apple-no-ad-fallback-v150.js` retirement (removes a behavioral guarantee).
- Safari icon links for `favicon-16.png`, `favicon-32.png`, `safari-pinned-tab.svg`.
- Public retirement of `fast-141.html`, which still serves legacy wordmark and copy.
- Service-worker precache resync and cache-name bump.
- Apple adapter consolidation and the duplicated `ampMusicPlayDirectIndex` ownership.
- QR share mutation-loop fix, which needs its own change and tests.
