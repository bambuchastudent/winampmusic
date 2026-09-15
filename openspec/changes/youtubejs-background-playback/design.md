# Design

## Architecture

Keep provider resolution separate from Ámpula Core and from queue/navigation state.

`track identity -> YouTube resolver adapter -> playable audio source -> HTMLAudioElement -> existing queue/navigation`

YouTube.js (`youtubei.js`) is the intended JavaScript implementation for the resolver adapter. The adapter must return a short-lived playable result and metadata; it must not rewrite the received Ámpula or make YouTube identity canonical.

## Background playback

The preferred resolved-audio path uses one long-lived HTMLAudioElement. The browser/OS therefore owns normal audio continuation. When `navigator.mediaSession` exists, AMPULAMP publishes title/artist/artwork and binds play, pause, previous-track, next-track, seek-backward, seek-forward, and seek-to actions to the same player/queue operations used by the visible UI.

No hidden timers, fake foreground state, or wake-lock tricks are used. Platform policy remains authoritative, so background playback is best-effort rather than guaranteed on every browser/device.

## Compatibility

The existing YouTube iframe path remains the fallback when a direct playable source cannot be resolved or cannot be consumed by HTML audio. Existing local-storage keys and Ámpula semantics remain unchanged.

## Failure modes

- Resolver unavailable: fall back to current provider playback.
- URL expired: resolve again, without mutating track identity.
- Media Session unsupported: playback still works; lock-screen metadata/actions are simply unavailable.
- OS/browser suspends the page: do not attempt to bypass platform restrictions.

## Dependency boundary

The static GitHub Pages client must not assume Node-only APIs. If YouTube.js cannot safely execute in the deployed browser environment, host/inject the adapter in an allowed runtime and expose only the minimal resolver contract to the player. Do not put secrets in the client.
