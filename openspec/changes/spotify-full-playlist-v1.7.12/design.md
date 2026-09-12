# Design

## Existing paths
The primary adapter calls `spotify.xwolf.space/api/playlist/:id` and normalizes any successful payload immediately. The fallback obtains an anonymous token and already paginates Spotify Web API `/playlists/:id/tracks` in 50-track pages up to 500 tracks.

## Completion policy
After a successful primary response, retain both normalized metadata and enough response shape to judge completeness.

A primary result is considered suspiciously incomplete when either:
- a numeric total/count hint in the payload is greater than the number of readable rows; or
- exactly 100 readable rows are returned, which is the observed primary/embed page boundary.

For a suspicious primary result, run the existing paginated Spotify Web API reader. Prefer the completed result only when it returns at least as many readable tracks as the primary result. If that completion request fails or returns fewer rows, keep the primary result.

## Identity boundary
Completion changes only how much Spotify-origin metadata is read. Spotify `title`, `artist`, playlist metadata and track IDs remain origin evidence. YouTube remains playback-only and cannot rewrite those fields.

## Failure modes
- Primary fails: existing fallback behavior remains unchanged and a fallback failure is a final import error.
- Primary succeeds but looks truncated, completion succeeds: use the complete paginated result.
- Primary succeeds but looks truncated, completion fails: import the primary rows instead of failing the whole operation.
- A legitimate exactly-100-track playlist may cause one extra completion attempt; if the Web API confirms 100, the result is unchanged.