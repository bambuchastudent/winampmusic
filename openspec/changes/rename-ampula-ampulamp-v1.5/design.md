# Design: Ámpula / ÁmpulaMP naming migration

## Naming ownership

The public naming model is intentionally simple:

- **Project / concept:** Ámpula
- **Player application:** ÁmpulaMP
- **Portable representation:** `.ampula`

README and `AGENTS.md` define the concepts for humans and coding agents. The production shell and PWA manifest expose the player name because those surfaces represent the application itself.

## Implementation

This is a static branding migration, not a runtime architecture change. Update the existing literals in the canonical production surfaces instead of adding a new branding framework or startup dependency.

The visible 1.5 bottle/lightning mark stays in place. Only its text/accessibility identity changes to ÁmpulaMP.

## Compatibility

The following historical identifiers stay unchanged in this change:

- `winampmusic.*` localStorage keys;
- `WINAMP_MUSIC_IMPORT` / acknowledgement message names;
- existing internal `__WINAMP_*` / `__AMP_MUSIC_*` flags and data attributes;
- the current GitHub Pages path while the repository slug remains `winampmusic`.

They are implementation compatibility identifiers, not public product naming. Keeping them avoids data migration, importer breakage, and cache/state regressions.

## Critical path

No new script, network request, event handler, storage migration, or provider dependency is added. The FAST invariant remains intact: local controls and saved library remain independent of optional provider/share modules.

## Failure modes

- An already-installed PWA can temporarily show cached old manifest metadata until the browser refreshes the manifest/service worker cache.
- Historical OpenSpec change documents can still contain old names because they record previously accepted contracts. The new spec explicitly supersedes their public-name requirement.
- Renaming the GitHub repository itself would change the Pages URL and external links, so it is deliberately separate from this runtime-safe naming migration.

## Verification

Update `tests/branding-v150.mjs` so it verifies the new player name in `index.html`, `manifest.webmanifest`, Media Session branding, share/QR copy, icon accessibility metadata, and the new OpenSpec contract while also asserting that compatibility storage identifiers remain unchanged.
