# Tasks: Listen-first received Ámpula

## Specification

- [x] Describe the problem, goal, scope and non-goals in `proposal.md`.
- [x] Define layout, ownership, ID boundaries, failure containment and deployment in `design.md`.
- [x] Add the `received-share-ux` capability spec.
- [x] Add the `share-ui-integrity` delta covering the listen-first structure and the export ID boundary.

## Tests

- [x] Prove a received link renders the shared track list immediately.
- [x] Prove the primary surface never shows `Save`, `Add to library` and `.ampula` at the same time.
- [x] Prove the primary surface exposes at most one secondary control.
- [x] Prove the library-mutation notice is absent from the first screen.
- [x] Prove tapping a track resolves and plays without `Add to library`.
- [x] Prove playback does not mutate `winampmusic.library.v1`.
- [x] Prove a failed resolution reports on that track only and keeps the dialog usable.
- [x] Prove a failed resolution keeps an already playing track playing.
- [x] Prove the secondary menu exposes `Save`, `Add to library` and `.ampula` export.
- [x] Prove `Save` persists the received object with no local resolver mutations.
- [x] Prove `Add to library` is explicit and never invoked by playback.
- [x] Prove `.ampula` export is still wired after being moved to the secondary menu.
- [x] Prove a self-contained `?a=` link and a short alias reach the same canonical receiver.
- [x] Prove `share-ui-cleanup-v162.js` is non-destructive against the listen-first dialog.
- [x] Keep the v1.6.2 received-dialog DOM-integrity regression green.

## Runtime implementation

- [x] Rebuild the received dialog: header (label, title, meta, close), player host, track list.
- [x] Add a single `⋯` secondary control and a collapsed `#ampulaMoreMenu`.
- [x] Move `Save`, `Add to library` and `.ampula` export into that menu.
- [x] Move the library-mutation notice into that menu.
- [x] Rename the received export action to `#ampulaExport` so copy normalization keeps it.
- [x] Render final labels (`Shared music`, `Save`, `Add to library`) directly.
- [x] Add per-track resolving/playing/unresolved state with a per-track note.
- [x] Keep `playReceivedTrack` on the existing resolve-and-play path.
- [x] Collapse the secondary menu on every render and on close.

## Deployment and documentation

- [x] Load `compact-share.js?v=164` from `fast-actions-v143.js`.
- [x] Bump the service-worker shell cache key.
- [x] Update the asset-query assertions in the repository, share-nonblocking and fast-actions contracts.
- [x] Document the listen-first receive flow in `README.md`.
- [x] Run the full `tests/*.mjs` and `verify-*.mjs` suite.
- [ ] Confirm the GitHub Pages verification run is green on the pull request.
