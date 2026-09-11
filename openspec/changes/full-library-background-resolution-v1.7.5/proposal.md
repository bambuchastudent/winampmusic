# Proposal — full-library background resolution v1.7.5

## Problem

The current playback resolver only warms two tracks ahead and aborts an individual resolution attempt after a few seconds. In real playlists this leaves most origin tracks unresolved and makes playback continuity depend on a very small window. A failed current track can also leave playback stopped instead of moving to another playable recording.

The production `Madigan — The News` case demonstrates the recall problem: a weak generic-video result is correctly rejected by final trust, but the exact recording may need a slower or deeper music search before it appears.

## Goal

Resolve every unresolved Spotify/Apple-origin track in the working library in the background, while preserving canonical title/artist/origin metadata. Give each recording a long bounded search budget (up to two minutes) and use deeper paginated music/video discovery before declaring it unresolved. Playback must continue to the next available playable recording when the requested row is not playable yet.

## Scope

- Replace the two-track-ahead warmup policy with full-library background resolution.
- Keep bounded worker concurrency so resolving a large playlist does not flood the browser/network.
- Increase the per-recording resolution budget to 120 seconds without blocking normal UI interaction.
- Expand Piped recall to query multiple music/video plans and follow search pagination within that budget.
- Keep the existing final-trust boundary for title, artist and duration; more search must never mean weaker trust.
- If the requested recording is unresolved, continue to the next playable recording while the unresolved search may continue in the background.
- Scan the complete library for the next playable row rather than stopping after twelve rows.

## Non-goals

- Do not rewrite Spotify/Apple canonical metadata with YouTube match metadata.
- Do not hardcode a YouTube ID for `Madigan — The News`.
- Do not weaken the final trust gate or accept a candidate only because a provider returned it.
- Do not require a backend or account.

## Success criteria

1. A library with more than two unresolved origin tracks starts background resolution for all unresolved rows.
2. Individual resolution jobs may continue for up to 120 seconds and remain non-blocking to the UI.
3. Piped search can continue onto next pages and alternate music/video query plans.
4. The Madigan regression can recover `s1b8Q5avQZs` from a later search page while rejecting `vuJwrcKQ7Sg`.
5. An unresolved requested row does not stop the queue when another playable row exists later in the library.
6. The queue may scan the whole library, not only the next twelve rows.
7. All existing identity/final-trust contracts remain green.
