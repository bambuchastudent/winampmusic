# Proposal: ÁmpulaMP v1.5.0

## Problem
FAST 1.4.x restored reliable controls and fast startup, but background playback support was removed from the critical path during the recovery. Sharing also needs one stable rule: a shared playlist or story asset must always route viewers back to ÁmpulaMP rather than becoming a dead-end file or opaque payload.

## Goal
Ship v1.5.0 as the stable FAST baseline with reliable foreground controls, lazy optional features, playlist Gift / QR and Clear actions, background/media-session support that cannot block startup or core controls, and site-first sharing.

## Scope
- Version the canonical FAST shell as 1.5.0.
- Restore background/media-session integration as a lazy module after the core player is interactive.
- Keep playback state synchronized with the FAST runtime.
- Use a standards-compliant YouTube iframe size while keeping it visually offscreen.
- Preserve Gift / QR, Clear, paste import, local filtering and 183-track incremental rendering.
- Keep all legacy interaction recovery/failsafe layers out of startup.
- Ensure playlist shares use an ÁmpulaMP URL as the primary destination.
- Ensure QR codes encode the same ÁmpulaMP URL shown/copied by the share flow.
- Ensure release/demo story media visibly contains an ÁmpulaMP URL and QR code that open the site.
- Pass the canonical site URL alongside media through the system share payload where supported.

## Non-goals
- Do not restore legacy `app.js` or service-worker startup ownership.
- Do not use capture/pointer interception.
- Do not guarantee playback when the mobile OS/browser explicitly suspends embedded YouTube media; the app must preserve state and resume cleanly.
- Do not add new content sources or unverified default media in this release.
- Do not depend on any social network preserving a clickable link inside an uploaded video; the QR + visible site URL are the platform-independent fallback.

## Success criteria
- Existing FAST control/import/action tests remain green.
- Background module loads only after core startup.
- Media Session play/pause/previous/next handlers call the existing FAST controls rather than replacing them.
- Current track and progress state are persisted for resume.
- Core startup remains under the existing 500 ms test budget with 183 saved tracks.
- Playlist share URL, copied URL, system-share URL and QR destination resolve to ÁmpulaMP.
- The v1.5.0 story/demo asset contains both a scannable QR code and a readable ÁmpulaMP URL.
