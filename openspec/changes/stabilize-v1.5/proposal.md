# Proposal: stabilize AmpMusic 1.5

## Problem
The current 1.5 release candidate introduced an unapproved AmpDrop/2.0 direction and regressed two previously expected capabilities: installable PWA behavior and playlist import into the FAST shell.

## Goal
Keep the public product on **AmpMusic 1.5**, preserve the existing 1.5 FAST fixes and logo, restore PWA installation/runtime behavior, restore the established YouTube playlist import contract, and lock future work behind the 1.5 roadmap/spec instead of silently publishing a major version.

## Scope
- Product name: `AmpMusic`.
- Public version: `1.5`; no automatic 2.0 publication.
- Preserve the existing visual logo/icon assets.
- Restore installable PWA registration without putting it on the synchronous startup path.
- Restore `WINAMP_MUSIC_IMPORT` / `WINAMP_MUSIC_IMPORT_ACK` playlist handoff for the FAST player.
- Keep existing single-track YouTube and Apple Music import behavior.
- Add regression tests for PWA wiring, branding/version lock, and multi-track playlist import.
- Record the next 1.5 roadmap stage: expanded track/playlist import and a Telegram interface. Telegram implementation is explicitly out of scope for this stabilization change.

## Non-goals
- No Telegram UI implementation now.
- No major-version bump.
- No logo redesign.
- No replacement of the FAST playback core.

## Success criteria
- Canonical UI and PWA manifest say `AmpMusic` and `1.5`.
- No visible 2.0 teaser exists in the production shell.
- Android Chrome can install/open the PWA after the stable runtime registers the service worker.
- A YouTube-origin playlist import containing multiple tracks is accepted, persisted through the FAST import API, and acknowledged to the importer.
- Existing core controls/import/background/action tests stay green.