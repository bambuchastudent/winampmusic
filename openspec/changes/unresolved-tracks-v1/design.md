# Design: unresolved tracks in the working library

## Ownership

The domain lives in the synchronous core, `fast-player-v141.js`, because `readLibrary`, `importTracks` and `saveLibrary` are the only writers of `winampmusic.library.v1`. Putting the rule anywhere else would let an optional module own core state, which the FAST invariant in `openspec/README.md` forbids.

Providers stay adapters: they hand recordings to `window.importTracks` and never decide whether a recording is allowed to exist.

## Two states of one track

| | resolved | unresolved |
|---|---|---|
| identity | `title` + `artist` | `title` + `artist` |
| `id` | YouTube video id (11 chars) | local recording id |
| playback | direct | resolve first |

`isResolved(track)` is `VIDEO_ID_RE.test(clean(track.id))`. There is no second stored flag, so no state can drift out of sync with the id, and existing rows classify correctly with no migration.

## Local recording id

Format: `U-` followed by 10 base36 characters, from a 64-bit FNV-1a hash of `` `${title}\0${artist}` `` lower-cased.

Two properties matter.

1. **Length 12, never 11.** `VIDEO_ID_RE` is `/^[A-Za-z0-9_-]{11}$/`, so a local id can never be mistaken for a YouTube id. `videoIdFromValue` returns `''` for it, which means every existing provider guard — `playIndex`, `updateTrackMetadata`, `clean-playback-v150.js`, `apple-musickit-v150.js`, `compact-share.js` `trackObservations` — already refuses it. The domain is safe by construction rather than by adding new checks in every adapter.
2. **Derived from identity, not random.** The same recording imported from two different sources collapses to one row, and a stored id stays stable across reloads. A random UUID would also be forbidden by `AGENTS.md` rule 19 as a canonical identity; this id is a local storage handle, and it is never written into an Ámpula.

Apple's pre-existing synthetic ids (`A` + 10 base36 = 11 chars, deliberately passing `VIDEO_ID_RE`) are untouched by this change.

## Import rules

`importTracks(items)` for each item:

1. `id = videoIdFromValue(item.id)`.
2. If there is no `id` and no identity (`title` is empty), skip. A row with neither a handle nor a name is not a recording.
3. If there is no `id`, use `localRecordingId(title, artist)`.
4. Deduplicate on the resulting id.
5. If a playable `id` arrives and a row already exists whose id equals `localRecordingId(title, artist)`, adopt the handle in place: that row's id becomes the YouTube id. This is a resolver result landing on local state, not a new recording.

Rule 5 is what makes an unresolved import from any source become playable later without duplicating the moment.

`readLibrary` keeps its existing filter on a non-empty stored `id` and its existing URL normalization. It no longer substitutes identity.

## Stored identity vs displayed identity

Storage keeps what is known:

```js
title: clean(track.title),      // may be ''
artist: clean(track.artist),    // may be ''
```

The view supplies the fallback at render time, in `makeRow` and `updateNowPlaying`. Nothing invented is ever persisted, so `compact-share.js` `toAmpula` cannot promote a provider handle to Core v1 identity, and the receiver's resolver never searches for a fabricated string.

The importers that used to fabricate — `fast-import-v150.js` for pasted YouTube links and playlists, `apple-music-import-v064.js` for unmatched Apple metadata — stop doing so and pass through what they actually know. `clean-playback-v150.js` and `fast-background-v150.js` keep their `YouTube <id>` fallbacks: those are display and MediaSession strings and are never written back to the library.

## Playback

`playIndex` already handles a track whose id is not playable: it calls `repairCurrentTrack`, which searches Invidious by `title` + `artist` and, on success, writes the found id onto the track and persists it. An unresolved track therefore resolves through the existing path with no new resolution code, and the resolved id is local mutable state.

When resolution fails the status distinguishes the two situations: a resolved-but-broken handle keeps `TRACK SOURCE INVALID · RE-IMPORT`, while a track that never had a handle reports `NO SOURCE FOUND · <title>` truncated, because "re-import" is not the useful advice there.

Sequential advance is unchanged: reaching an unresolved track attempts resolution and stops if it fails. Automatic skipping is deliberately out of scope; silently jumping over a track the sender chose would contradict the moment.

## Compatibility

- Storage key `winampmusic.library.v1`, runtime marker `1.4.1-fast` and `CURRENT_KEY` are unchanged.
- Existing rows are read unchanged; a legacy malformed id stays stored and is simply classified unresolved, which is what the existing repair flow already assumed.
- `window.importTracks` keeps its `{ added, total }` return shape.
- No new global is required by adapters; `isResolved` is exposed as `window.ampMusicIsResolved` only so tests and future resolver work can share one definition.

## Contract change

`tests/youtube-error2-v150.mjs` currently asserts that `importTracks([{ id: 'not-11', title: 'Bad', artist: 'Bad' }])` adds nothing. The invariant that test protects is *a malformed provider id must never reach the provider*, not *the recording is destroyed*. Under this change the recording is kept as unresolved, the malformed id is discarded rather than stored, and it still never reaches `loadVideoById`. The assertion is updated to state that stronger contract.

## Failure modes

| failure | behaviour |
|---|---|
| item has neither id nor title | skipped, `added` unchanged |
| hash collision between two recordings | second import deduplicates into the first; acceptable at 64 bits for a local library |
| repair search unavailable | track stays unresolved and visible, status reports no source |
| stored id is a legacy malformed string | classified unresolved, repairable by title/artist |
| localStorage write fails | existing silent catch in `saveLibrary`, unchanged |

## Critical path

The addition is a hash function, two display helpers, one resolution test and a rewritten `importTracks` — roughly one kilobyte of source. `tests/performance-v150.mjs` keeps its `< 250 ms` synchronous startup gate and `tests/fast-player-v141.mjs` keeps its `< 500 ms` gate; both still pass unchanged, because the added work is per-import, not per-boot.

The source budget in `tests/performance-v150.mjs` is raised from 18000 to 19000 bytes. The alternative — moving the library domain into an optional module — is refused: `readLibrary`, `importTracks` and `saveLibrary` are the only writers of `winampmusic.library.v1`, and the FAST invariant requires the core to own them.

The budget is expected to come back down in the follow-up resolver change: `REPAIR_SEARCH_INSTANCES` and `findRepairCandidate` are 1037 bytes of Invidious search sitting in the synchronous core, they are only ever reached after a failed playback, and `ampula/RESOLVER.md` places resolution in its own layer. Extracting them there returns the core to roughly 17.5 KB.
