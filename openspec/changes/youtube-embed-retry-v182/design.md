# Design: YouTube embed retry v1.8.2

## Ownership

This change is a playback-adapter concern. Ámpula Core continues to own recording identity while YouTube IDs remain replaceable local playback observations.

## Architecture

A small runtime adapter observes the existing player status for iframe error `101` or `150`. For the current track it:

1. records the failed YouTube ID in an in-memory attempted set keyed by normalized title + artist;
2. searches a short list of public Invidious API instances with the canonical title and artist;
3. selects the first valid video ID not already attempted;
4. writes only that playback ID to the local working-library track;
5. calls the existing `window.playIndex(index)` path to retry.

The adapter does not consume returned provider title/author metadata as canonical metadata.

## Critical-path constraints

The adapter loads after the existing player and is not required for startup or normal playback. Search begins only after an embed-denied error. Core controls remain owned by the existing player/navigation runtime.

## Loop prevention

Each recording keeps an ephemeral attempted-ID set. A maximum number of alternate candidates is tried per recording. The observer is guarded by a repair-in-progress flag so status mutations cannot start concurrent repairs.

## Compatibility

- Existing valid YouTube playback is unchanged.
- YouTube.js audio-first remains best-effort and may fall back to iframe playback.
- Queue and shuffle behavior remain owned by the existing `playIndex`/navigation path.
- Saved title/artist/origin metadata is never replaced by search-result metadata.

## Failure modes

If all resolver instances fail, return no candidate, or only return already-failed IDs, the adapter shows `YOUTUBE UNAVAILABLE · TRY LATER` and does not mutate identity. If a replacement ID also rejects embedding, the same process may try another unseen ID up to the bounded limit.
