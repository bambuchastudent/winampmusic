# YouTube.js background playback

## Problem

AMPULAMP currently uses an off-screen YouTube player for YouTube playback. Browser/PWA background playback is fragile when playback ownership remains tied to an embedded video player, especially on mobile lock screens.

## Goal

Introduce a provider adapter boundary for a future YouTube.js (`youtubei.js`) based resolver and make background/lock-screen playback a first-class runtime contract using native HTML audio plus the Media Session API where supported.

## Scope

- Add a YouTube.js resolver adapter contract, kept outside Ámpula Core.
- Resolve playable media into the existing playback layer rather than changing Ámpula identity.
- Prefer an HTMLAudioElement for resolved audio so normal browser media lifecycle and Media Session integration can be used.
- Expose play/pause/previous/next controls through Media Session when supported.
- Preserve existing YouTube iframe playback as a compatibility fallback.
- Document YouTube.js attribution and license location.

## Non-goals

- YouTube.js is not part of the Ámpula format.
- No provider-specific IDs become canonical track identity.
- No promise to bypass browser, OS, YouTube, DRM, authentication, or provider restrictions.
- No fake wake-lock or attempt to keep a page artificially foregrounded while a phone is locked.

## Success criteria

1. Background playback support has an explicit provider-independent playback contract.
2. YouTube.js integration is isolated behind a resolver adapter.
3. Media Session metadata/actions are driven from the currently playing track.
4. Existing playback remains available when direct audio resolution is unavailable.
5. Third-party attribution links to the upstream YouTube.js project and license.
