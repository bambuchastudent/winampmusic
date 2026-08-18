# Design: Winamp Music v1.5.0

## Runtime ownership
`fast-player-v141.js` remains the sole owner of core playback and library interaction. Optional modules may observe state and invoke the public FAST functions/buttons, but may not replace handlers or intercept events globally.

## Background module
A new `fast-background-v150.js` loads asynchronously after the core has reached `READY · FAST`. It:
- integrates with Media Session when available;
- updates metadata and playback state from the FAST UI/runtime;
- maps system media controls to the existing Play/Prev/Next buttons;
- persists current track, elapsed time, duration and intended playback state;
- offers/resumes the same track when the page returns after suspension;
- never runs in the synchronous startup path.

## Player iframe
The YouTube IFrame API player will use a 200x200 player viewport (YouTube-supported minimum) positioned far offscreen and non-interactive instead of a 1x1 player. This does not guarantee OS background playback, but avoids relying on an unsupported tiny embed geometry.

## State compatibility
The FAST runtime will mirror the selected track into `winampmusic.player.v1.currentId` so existing share/background state can resolve the current track without scanning UI text.

## Failure behavior
If Media Session is unavailable or the browser suspends the YouTube iframe, foreground playback controls remain unaffected. The background module records a resume snapshot and restores the track/position when the app becomes active again.

## Critical-path constraints
The release SHALL NOT add service-worker registration, legacy `app.js`, recovery/failsafe scripts, QR/share code or background code to the synchronous player startup path.
