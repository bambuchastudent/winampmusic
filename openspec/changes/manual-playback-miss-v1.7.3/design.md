# Design: manual playback miss recovery v1.7.3

## Ownership

`playback-miss-v173.js` owns user rejection state and the `MISS` control. It does not own canonical identity or matching policy.

The existing YouTube matcher remains responsible for candidate search/ranking. It gains a generic `excludeYoutubeIds` input so callers can remove locally rejected IDs before ranking. The existing final trust gate remains the last authorization boundary before persistence/playback.

## Rejection identity

Rejected playback IDs are stored outside the music library under `ampula.playbackRejectedMatches.v1`. The key is derived from normalized canonical artist + title + duration. This lets Spotify/Apple imports and later retries reuse the rejection without writing mutable playback state into canonical metadata.

Each recording keeps at most 20 rejected YouTube IDs.

## MISS flow

1. Resolve the current library row and actual/stored YouTube ID.
2. Persist the ID in the local rejection store.
3. Call `ampMusicYouTube150.suspend()` before any network retry.
4. Replace the row's YouTube playback handle with its local unresolved recording ID and clear YouTube trust/cache fields only.
5. Keep title, artist, playlist and origin/provider evidence unchanged.
6. Call the normal `playIndex()` path for the same row.
7. Resolver guard augments matcher metadata with rejected IDs; matcher filters them before shortlist/ranking.
8. If the same row still cannot resolve, try following rows until one plays or the bounded scan ends.

## UI

The `MISS` button shares `.screen-status-row` with the status text and ad indicator. It uses the same compact yellow/black Winamp-like visual language. Label is `MISS` for zero prior rejections and `MISS · N` afterwards.

The button is shown only for the current canonical Spotify/Apple recording when there is a YouTube playback candidate to reject. It is disabled while a retry is in progress.

## Safety

- Rejected IDs are candidate-local, not recording identity.
- No hardcoded artist/title/video mapping is introduced.
- Existing final-trust validation remains mandatory.
- The matcher exclusion happens before shortlist truncation so rejecting the top result exposes the next candidate rather than merely failing the same result again.
- Failure remains fail-closed: unresolved is preferred over a wrong recording.

## Compatibility

Existing libraries require no migration. Rejection state is additive localStorage data. Existing final-trusted cached matches remain playable until the user explicitly marks one as `MISS`.