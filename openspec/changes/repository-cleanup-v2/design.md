# Design: repository cleanup v2

## Safety model
This change inherits the `repository-cleanup-v1` safety model unchanged: a
file is removable only after every applicable dependency class is checked,
and absence from `index.html` is never sufficient.

v2 adds one rule learned from the audit:

**Transitive reachability, not filename grep.** A file is unreachable only if
no path from a real entry point reaches it. Entry points are `index.html`,
`sw.js`, `manifest.webmanifest`, and the public standalone pages
`recover.html`, `recover-fresh-140.html`, and `fast-141.html`. A file whose
only referrer is itself unreachable is unreachable, and the referrer must be
removed first so no intermediate state points at a missing target.

## Evidence for this batch

### lyrics/comments cluster
All six files were unlinked from `index.html` in `3f9a811`
("v1.4.0: boot only the stable player core") and none is reachable from any
entry point.

| File | Only inbound reference | Class |
|---|---|---|
| `comments.js` | none | unreachable root |
| `lyrics-sync.js` | `comments.js:16` `script.src` | unreachable via unreachable referrer |
| `lyrics.js` | none | unreachable |
| `lyrics-v057.js` | none | unreachable |
| `comments.css` | none | unreachable |
| `captions.css` | none | unreachable |

No `window.*` global from these files is consumed elsewhere. No test,
workflow, service-worker entry, or manifest entry names them. No active
OpenSpec change requires them; `fast-player-v1.4.3/specs/fast-runtime`
mentions lyrics and comments only to forbid them from being required by core
controls, which removal satisfies trivially.

Removal order is `comments.js` first, then `lyrics-sync.js`, so the loader is
never left pointing at a missing file.

### Stale branding contracts
`verify-bottle-label-v154.mjs`, `verify-bottle-lightning-v155.mjs`, and
`verify-brand-v155.mjs` are executed by no workflow and fail against current
markup. `verify-brand-v155.mjs` asserts `<h1>Ampula MP</h1>` without the
diacritic, which directly contradicts the `<h1>Ámpula MP</h1>` assertion in
`tests/repository-integrity-v1.mjs` and the `rename-ampula-ampulamp-v1.5`
branding change. Keeping a contract that asserts the opposite of the current
contract is a hazard, not coverage.

`verify-logo-fit-v158.mjs` and `verify-mobile-bottle-fit-v157.mjs` also run
in no workflow, but they pass and describe current geometry. They are wired
into CI rather than removed, converting dead scripts into live coverage.

## Runtime invariants
Unchanged from v1 and re-verified after each batch:
`winampmusic.library.v1`, `winampmusic.fast.current.v1`,
`winampmusic.player.v1`, `winampmusic.background.v1`;
`fast-player-v141.js` as core playback/library owner; Apple
track/album/playlist import and provenance/playability separation;
`import-playback-guard-v159.js` Now Playing preservation;
`fast-actions-v143.js` immediate Share/QR shell with lazy modules;
shared-link receiver; background/PWA/recovery; header/footer branding and the
playback-state visualizer.

### Compatibility key note
`winampmusic.comments.v4` is owned solely by `comments.js` and is read by
nothing else. It disappears with its only owner. This is recorded explicitly
because AGENTS.md requires compatibility keys to be preserved: the key is not
migrated or renamed, and no surviving code path reads it, so no compatibility
surface changes.

## Deliberately retained
- `apple-no-ad-fallback-v150.js` — not loaded at runtime, and
  `tests/apple-musickit-in-player-v150.mjs` actively forbids loading it, but
  `tests/apple-album-source-v150.mjs` still evaluates it to prove an Apple
  playback failure does not fall through to an ad-bearing YouTube iframe.
  That guarantee is provenance/playability relevant. Retiring it means
  removing a behavioral guarantee, which needs its own decision.
- `recover.html`, `recover-fresh-140.html`, `fast-141.html` — publicly
  addressable recovery/fallback URLs, retained under the v1 requirement that
  ambiguous public entrypoints stay until their URL compatibility is
  explicitly retired.
- `favicon-16.png`, `favicon-32.png`, `safari-pinned-tab.svg` — unreferenced
  because the Safari icon `<link>` tags are gone. That is an icon regression
  to decide on, not dead weight to sweep.
- `APPLE_IMPORT_V064.md` — documents the still-live lazy module
  `apple-music-import-v064.js`.
- `robots.txt`, `sitemap.xml` — served by crawler convention.

## Failure modes
- Removing `lyrics-sync.js` before `comments.js` would leave a live loader
  pointing at a missing file. Mitigated by fixed removal order.
- Removing a file still named by a workflow would break CI silently.
  Mitigated by the removed-filename scan in `repository-integrity-v1`, which
  fails if any executable or config file still names a removed target.
- Deleting the two passing branding contracts would lose real coverage.
  Mitigated by wiring them into CI instead.

## Removal batches
Batches stay small and are verified independently. If any evidence is
ambiguous, the file remains.
