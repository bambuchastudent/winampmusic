# Design: Apple import resilience

## Principle

The adapter has two independent jobs, and the current code conflates them:

1. **Read** the Apple page into recordings — title, artist, album, duration, Apple URL.
2. **Resolve** each recording to something the runtime can play right now.

Job 1 is the durable one; its output is musical identity. Job 2 is a local, time-dependent lookup that can fail for reasons that have nothing to do with the recording. Failure in job 2 must never delete the output of job 1.

## Reader outcomes

`fetchPublicPlaylist` currently has two exits: a playlist, or a throw. It gets three:

| condition | outcome |
|---|---|
| HTTP not ok | throws — the transport failed, nothing was read |
| markdown parsed into tracks | `{ name, tracks }` |
| markdown returned but no tracks parsed | `{ name, tracks: [] }` — no throw |

The zero-track case stops being an exception because it is not an error condition for the caller to recover from; it is a fact about the playlist. `importPlaylistUrl` reports it with its own `phase: 'empty'` status and returns `{ handled: true, empty: true, tracks: [] }`.

This distinction is what the user sees: `This Apple Music playlist has no readable tracks` instead of `Could not import this Apple Music playlist`.

`fetchPublicPlaylist` is a published API on `window.ampMusicApplePlaylist150` and `apple-catalog-first-v150.js` calls it, so both playlist paths inherit the change from one place.

## Match outcomes

`resolveTracks` and `playlistTrack` return a track for every input, never `null`.

```
match found      -> { id, title, artist, ..., badges: [..., 'YouTube match'] }
no match / error -> {     title, artist, ..., badges: [..., 'Unresolved'   ] }
AbortError       -> propagates unchanged
```

The unresolved shape deliberately omits `id`. The core assigns the local recording id, which keeps id generation in one place and guarantees the adapter cannot invent a provider-shaped id. It keeps `sourceUrl` and `appleTrackUrl`, so `compact-share.js` `trackObservations` records an `apple-music` observation when the track is later shared — historical evidence, exactly as `ampula/README.md` requires, and never identity.

`results.filter(Boolean)` disappears from all three call sites, which is also what preserves source order: previously a dropped track shifted every later track's position.

## Locating an imported recording

`importPlaylistUrl` needs the library index of the track it should start playing, and `apple-catalog-first-v150.js` needs to detect a recording it already imported. Both used `track.id`, which an unresolved track does not have until the core assigns one.

The core exposes `window.ampMusicRecordingId(title, artist)` — the same deterministic function it uses internally. An adapter asks for the id the core *will* assign rather than guessing or duplicating the hash. `apple-catalog-first-v150.js` `existingIndex` falls back to it when there is no `appleTrackId` and no playable id.

## Playback

`libraryIndex(tracks[0].id)` assumed the first track is playable. With unresolved tracks present, the first track often is not, and `libraryIndex('')` returns `-1`, which silently disables autoplay.

The rule becomes: start the first track that is playable. If no track is playable, do not start playback and say so in the status. Automatically launching a resolver search for every track of a freshly imported playlist would be slow and would contradict the on-demand resolution decided in `unresolved-tracks-v1`.

## Status copy

The done status becomes:

```
<total> tracks · <matched> matched · <unresolved> unresolved · <added> new
```

The `unresolved` segment is omitted when it is zero, so a fully matched import reads exactly as before. This is a contract change: `tests/apple-playlist-v150.mjs` asserts `5 tracks · 4 matched · 4 new` for an import that drops one track, and is updated to the new counts.

## Compatibility

- `parsePlaylistUrl`, `parsePlaylistMarkdown`, `parseAlbumUrl` and the matcher APIs are unchanged.
- `importPlaylistUrl` / `importAlbumUrl` keep returning `{ handled, playlist|album, tracks, added }`; `tracks` now contains every read track rather than only the matched ones, and gains `empty: true` for an empty playlist.
- Existing import messages that are asserted elsewhere (`Could not import this Apple Music playlist`, `Could not import this Apple Music album`) are preserved for the failure paths they still describe.
- No storage key changes.

## Failure modes

| failure | behaviour |
|---|---|
| reader HTTP error | error status, nothing imported |
| reader returns unparseable page | empty status, nothing imported, no exception |
| matcher module missing | every track imported as unresolved |
| single track matcher throws | that track imported as unresolved, the rest continue |
| every track unmatched | all imported as unresolved, no autoplay |
| user aborts | unchanged, `{ handled: true, aborted: true }` |
