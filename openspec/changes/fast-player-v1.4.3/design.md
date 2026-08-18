# Design: FAST 1.4.3 playlist actions

## Architecture
The FAST player remains the only owner of playback controls and the local library runtime.

`fast-actions-v143.js` is an optional UI extension loaded after the core player scripts. It may add buttons and lazy-load optional modules, but it must not register global capture/pointer handlers or replace playback controls.

## Critical-path invariant
Normal page startup must not load:
- `compact-share.js`
- `qr-share-v1.js`
- background playback modules
- legacy `app.js`
- service workers
- interaction failsafe/recovery modules

The player must become interactive from local state before optional network work begins.

## Gift / QR
1. Add a lightweight `Gift / QR` button in the playlist header.
2. On first activation, lazy-load `compact-share.js`.
3. After compact sharing is ready, lazy-load `qr-share-v1.js`.
4. Reuse the existing encrypted short-link format and existing QR renderer.
5. A recipient merges tracks into their current library; existing tracks are not deleted.

## Clear
`Clear` is intentionally two-step:
1. First tap arms the destructive action for five seconds and changes label to `Confirm clear`.
2. Second tap within the window clears the Winamp Music playlist/current-playback keys and reloads the page.

It must not clear browser cache, site storage unrelated to the playlist, service-worker data, or user settings.

## Regression prevention
Tests must verify the critical-path invariant and user-visible actions. Optional modules should have their own targeted tests and must not change the core Play/Prev/Next/track-click ownership model.
