# Design

Each `resolveAudio` report owns its timestamp, restriction category, and player transport fields. The relay fetch layer records only a successful safe transport label for `/youtubei/.../player` requests after extracting a valid video ID from the request body. Resolution captures the per-video request sequence before and after `getBasicInfo`, then adopts evidence from that interval; the resolver does not consult a single mutable “last transport” field. Same-video player requests or overlapping same-video basic-info lookups mark route evidence ambiguous, including the case where only one overlapping lookup emits a request.

The category classifier examines only the returned playability status and a bounded set of English reason/screen phrases. Bot-confirmation and age-confirmation phrases take precedence over generic sign-in wording. It returns one of `BOT_CONFIRMATION_REQUIRED`, `AGE_CONFIRMATION_REQUIRED`, `SIGN_IN_REQUIRED`, or `UNKNOWN`; it never returns or renders upstream prose.

Existing retry semantics remain unchanged: YTMUSIC is considered only when WEB has no streaming data and the basic-info result is `OK` with zero audio formats. Every non-OK status, including `LOGIN_REQUIRED`, stops alternate-client attempts and uses the existing iframe fallback outside YouTube.js-only mode. Diagnostics remain observational and do not mutate tracks or classify a video as permanently unplayable.

## Impact and verification

- Graphify: unavailable. Serena: unavailable. The bundled impact scanner (`impact-scan.sh getBasicInfo HEAD`) found the adapter lookup, the new diagnostics test, and the existing auth experiment lookup; only the adapter, this change's test, and this change's OpenSpec files are in scope.
- Entry point: `resolveAudio(videoId, suppliedInnertube)`; transport observation: `relayFetch` for YouTube.js player requests.
- Related checks: v1.8.9 diagnostics, v1.9.0 diagnostics, browser-audio, and relay behavior tests. Existing playback retry/fallback assertions stay authoritative.
- Risk: YouTube.js may issue zero or multiple player requests during `getBasicInfo`; those cases intentionally report `UNKNOWN` unless exactly one safe transport event can be correlated.
- Boundaries: no loader/cache version, CI workflow, documentation outside this change, or unrelated working-tree files.
