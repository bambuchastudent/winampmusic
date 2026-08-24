# Apple Music in-player playback

## Requirements

### Apple source priority
When a saved Apple Music track has an Apple catalog song ID and MusicKit is configured, AmpMusic MUST attempt MusicKit playback inside the current page before any fallback source.

### In-player fallback
If MusicKit is unavailable, not configured, authorization is declined, or playback fails, AmpMusic MUST fall back to the existing strict Apple-to-YouTube/direct-audio resolver without leaving the page.

### No external playback navigation
Play, Add & Play, playlist import, album import, next/previous, and retry paths MUST NOT call `window.open`, `location.assign`, or otherwise navigate to `music.apple.com` as a playback mechanism.

### Collection import
Apple Music album and playlist URLs MUST continue through AmpMusic import logic and MUST NOT be intercepted for provider-native external playback.

### Secret handling
The Apple Music private key MUST remain in GitHub Actions secrets. The Pages artifact MAY contain a short-lived/origin-restricted developer token, but MUST NOT contain the private key.

### Compatibility
YouTube playback behavior and AmpMusic public version 1.5 MUST remain unchanged.