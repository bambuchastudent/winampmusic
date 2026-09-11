# Design: latest playback intent

## Queue generation

`playback-queue-v170.js` owns a monotonic navigation generation. Every wrapped `window.playIndex(...)` call increments it. Async explicit-selection resolution captures its generation and may call the underlying player only if that generation is still current.

This keeps resolution useful: a stale resolver may still cache a trusted playback handle for its recording, but it cannot steal transport focus from a newer request.

## Sequential continuation

The existing full-library skip contract remains unchanged: with Shuffle OFF, Next/ENDED scans forward in library order and skips unresolved rows. Because a newer Next request advances the generation, any older explicit resolver becomes transport-stale before row 7 is activated.

## Pending Pause

`fast-player-v141.js` tracks intended playback separately from provider state. A new play request sets the intent to playing and immediately renders Pause. If Pause is pressed before provider startup completes, the request generation is invalidated and the provider is paused if already available. A delayed ready callback checks the request generation before loading audio.

## Identity boundary

No matching result becomes canonical metadata. Existing title/artist preservation in queue persistence remains untouched.
