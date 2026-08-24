# Design: repository cleanup v1

## Safety model
A file is removable only after checking every applicable dependency class:
1. direct HTML/script/style/manifest reference;
2. lazy or dynamic loading (`script.src`, `import()`, service-worker registration, fetch/path strings);
3. public `window.*` APIs and compatibility identifiers consumed elsewhere;
4. service-worker precache/runtime and web-manifest references;
5. current tests and production OpenSpec contracts;
6. GitHub Actions and GitHub Pages generation/deploy inputs;
7. public/recovery entrypoints whose URL compatibility may matter.

Absence from `index.html` alone is never sufficient.

## Dependency graph
The repository-integrity test starts from current `index.html` local scripts and recursively follows local quoted JavaScript targets. It additionally validates `sw.js` and `manifest.webmanifest` file references. This models the production entry graph without treating unrelated historical modules as current startup dependencies.

Historical workflows and their coupled files are intentionally not removed in this change merely because the workflows are stale. Retiring such a cluster requires an explicit follow-up decision so a workflow reference cannot be silently broken by cleanup.

## Runtime invariants
Cleanup MUST preserve:
- `winampmusic.library.v1`, `winampmusic.fast.current.v1`, playback/background state keys, and existing runtime compatibility APIs;
- `fast-player-v141.js` as the core playback/library owner;
- current Apple track/album/playlist import and provenance/playability behavior;
- `import-playback-guard-v159.js` behavior so background imports do not steal active Now Playing;
- `fast-actions-v143.js` immediate Share/QR shell with lazy share/QR modules;
- shared-link receiver behavior;
- delayed background/PWA/recovery behavior;
- current Ámpula MP header/footer branding and playback-state visualizer.

## Removal batches
Removals are intentionally small. After each batch, the branch must satisfy syntax checks, repository integrity, current targeted behavioral contracts, removed-filename scans, service-worker/manifest checks, and Pages input checks.

If any evidence is ambiguous, the file remains.

## Baseline caveat
The repository contains historical GitHub Actions whose grep/assertion contracts no longer match current production markup or wiring. Their pre-existing failures are recorded as baseline and are not treated as proof that current runtime is broken. Cleanup relies on current targeted contracts plus the dedicated repository-integrity gate.
