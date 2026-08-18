# Proposal: Winamp Music v1.5.0

## Problem
FAST 1.4.x restored reliable controls and fast startup, but background playback support was removed from the critical path during the recovery. The product needs a stable release that preserves the FAST interaction contract while restoring mobile media-session/background behavior on a best-effort basis.

## Goal
Ship v1.5.0 as the stable FAST baseline with reliable foreground controls, lazy optional features, playlist Gift / QR and Clear actions, and background/media-session support that cannot block startup or core controls.

## Scope
- Version the canonical FAST shell as 1.5.0.
- Restore background/media-session integration as a lazy module after the core player is interactive.
- Keep playback state synchronized with the FAST runtime.
- Use a standards-compliant YouTube iframe size while keeping it visually offscreen.
- Preserve Gift / QR, Clear, paste import, local filtering and 183-track incremental rendering.
- Keep all legacy interaction recovery/failsafe layers out of startup.

## Non-goals
- Do not restore legacy `app.js` or service-worker startup ownership.
- Do not use capture/pointer interception.
- Do not guarantee playback when the mobile OS/browser explicitly suspends embedded YouTube media; the app must preserve state and resume cleanly.
- Do not add new content sources or unverified default media in this release.

## Success criteria
- Existing FAST control/import/action tests remain green.
- Background module loads only after core startup.
- Media Session play/pause/previous/next handlers call the existing FAST controls rather than replacing them.
- Current track and progress state are persisted for resume.
- Core startup remains under the existing 500 ms test budget with 183 saved tracks.
