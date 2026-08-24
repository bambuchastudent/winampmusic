# Design

## Playback order

For tracks with Apple provenance:

1. If the track has an Apple catalog song ID and a MusicKit developer token is configured, lazily load MusicKit on the Web, request user authorization when needed, queue that Apple song ID, and play it inside AmpMusic.
2. Otherwise, or when MusicKit authorization/playback fails, use the existing strict Apple-to-YouTube match and direct-audio resolver.
3. If neither in-player source is usable, remain in AmpMusic and show an unavailable status. Never open an Apple Music URL as a playback fallback.

## Configuration

GitHub Pages remains static. A checked-in `apple-music-config.js` contains an empty safe default. The Pages workflow may replace it at deploy time using `APPLE_MUSIC_TEAM_ID`, `APPLE_MUSIC_KEY_ID`, and `APPLE_MUSIC_PRIVATE_KEY` repository secrets. A small Node script signs an ES256 developer token with an origin claim restricted to `https://bambuchastudent.github.io`. The private key is never written into the deployed artifact.

## Runtime integration

`apple-musickit-v150.js` owns MusicKit loading, authorization, queueing, and custom-player control bridging. It wraps the existing direct-play entry point so single-track and album imports prefer MusicKit automatically. It also patches Apple playlist import after the lazy playlist module appears so the first imported track follows the same source preference.

The source-URL routing regression is removed from `index.html`; `apple-url-route-v151.js` and the external-opening fallback are not loaded.

## Compatibility

Ordinary YouTube imports keep the existing FAST YouTube path. Radio stays separate. AmpMusic public branding/version remains 1.5.