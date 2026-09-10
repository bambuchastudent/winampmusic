# Design — Spotify played tracks in Your library

## Architecture
Spotify remains an optional provider playback adapter. `spotify-playlist-embed-v160.js` owns the Spotify IFrame controller and emits a small provider-neutral browser event whenever Spotify reports `playback_started` or `playback_update` for a track. A separate `spotify-played-library-v161.js` module owns persistence into the existing local library.

The retention module:
1. extracts the Spotify track id from `playingURI`;
2. derives the canonical Spotify track URL;
3. uses Spotify oEmbed for public title/artwork metadata;
4. optionally asks the existing client-side YouTube resolver for a playback fallback and a better display artist when available;
5. calls the existing `window.importTracks()` API so the in-memory FAST library updates immediately;
6. patches provider provenance into the serialized library entry and keeps a tiny sidecar keyed by Spotify track id for repeated-play deduplication and UI decoration.

## Ownership
- Spotify IFrame adapter owns Spotify playback and provider events.
- Played-track retention owns local persistence/provenance only.
- FAST player remains owner of library rendering and normal YouTube playback.
- Ámpula Core remains provider-independent and is not modified.

## Critical-path constraints
The feature is lazy and event-driven. No Spotify metadata lookup, matching, or persistence runs during startup. Playback is never blocked waiting for oEmbed or cross-provider matching. Failures are logged and retried only when the track is played again.

## Compatibility
Existing `winampmusic.library.v1` remains the library storage. New fields are additive: `spotifyTrackId`, `spotifyTrackUrl`, `spotifyPlaylistId`, `spotifyPlaylistUrl`, `spotifyPlaylistTitle`, `spotifyPlaylistOwner`, and `spotifyPlayedAt`. The existing renderer ignores unknown fields safely.

A played Spotify track may also carry a resolved YouTube `id` as a fallback playback source; that does not replace Spotify provenance. If no YouTube candidate is found, `importTracks()` creates the existing unresolved local recording id from title/artist.

## Metadata strategy
Spotify IFrame events provide the playing Spotify URI and playback duration but not full track metadata. Spotify oEmbed is used for the public track title and artwork. If the existing client-side YouTube resolver is available, it may supply a display artist/channel and a fallback YouTube id. The Spotify track and playlist URLs remain the authoritative provider provenance regardless of that fallback.

## Failure modes
- oEmbed unavailable: do not create a misleading anonymous library row; keep the event eligible for retry on a later play.
- YouTube resolver unavailable: save the Spotify track as an unresolved local recording using the Spotify title.
- Same Spotify track played repeatedly: update `spotifyPlayedAt`/duration/provenance, do not add a duplicate row.
- Existing library recording already matches by title/artist: enrich that row with Spotify provenance rather than duplicating it when possible.
- Spotify embed closes: retained library entries remain; closing only stops/removes the provider playback panel.