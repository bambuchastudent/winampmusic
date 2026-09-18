# Design

## Isolation boundary

The query parameter `playback=youtubejs` is a runtime diagnostics switch. It changes playback-provider selection only; it never changes title, artist, origin, resolver evidence, or stored Ámpula Core.

## FAST player

FAST remains the library/UI owner, but in isolation mode it must not load the YouTube iframe API, create a YT.Player, warm it, resume it, or use it as a direct Play path. Its Play button delegates through `window.playIndex`, allowing the YouTube.js adapter to own the transport.

If the adapter has not installed yet, FAST reports `YOUTUBEJS ONLY · WAITING FOR ADAPTER` instead of starting iframe playback.

## YouTube.js adapter

The adapter detects the same query parameter. Its capture handler owns Play even before native audio is active. Resolver/native-media failures produce a visible `YOUTUBEJS ERROR · …` and return false without calling the saved iframe `playIndex`.

The adapter keeps title/artist/origin untouched.

## Loader

In isolation mode the release loader loads YouTube.js immediately and does not load the iframe retry adapter. Normal mode retains current fallback behavior.

## Verification

A production smoke test uses a known YouTube video through the legacy receive-only `?p=` route plus `playback=youtubejs`. The test is successful only if status reaches `PLAYING · YOUTUBEJS · AUDIO` and elapsed time advances.
