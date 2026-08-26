# Proposal: the Apple import never destroys a recording it read

## Problem

The Apple Music adapter reads a playlist or album, obtains title, artist, album and duration for each track, then throws all of that away for any track it cannot currently match on YouTube.

- `apple-playlist-import-v150.js:226` — `results.filter(Boolean)` drops every unmatched track.
- `apple-playlist-import-v150.js:244` — if nothing matched, `throw new Error('No playlist tracks could be matched on YouTube')`.
- `apple-playlist-import-v150.js:159` — if the reader returned a page but no tracks were parsed, `throw new Error('Apple playlist contained no readable tracks')`.
- `apple-catalog-first-v150.js:187,203` — `playlistTrack` returns `null` for an unmatched track; `:246-247` repeat the same filter-and-throw.
- `apple-album-import-v150.js:154,172` — the album path repeats it again.

Every one of those throws lands in the same `catch`, which reports `Could not import this Apple Music playlist`. So a playlist whose tracks are no longer available on YouTube produces a single opaque error and an empty library, which is exactly the reported bug. A playlist where half the tracks are unavailable silently loses that half, with no indication that anything was dropped.

This behaviour existed because a library track could not exist without a playable provider id. `unresolved-tracks-v1` removed that constraint, so the adapter is now the only thing destroying recordings.

It also contradicts the format rules: the adapter read real human-readable identity, and `AGENTS.md` states that a current playable source is neither identity nor a precondition for a recording.

## Goal

Make the Apple adapter report what it found rather than deciding what is worth keeping.

- Every track the adapter successfully read reaches the library, in the source order.
- A track that cannot be matched right now is imported as unresolved, keeping title, artist, album, duration and its Apple URL.
- A playlist with nothing readable is reported as empty, which is not the same as a failure to read.
- Only a genuine transport or parse failure is reported as an error.

## Scope

- `apple-playlist-import-v150.js`: reader outcome classification, unresolved match results, no filtering, no throw on zero matches.
- `apple-catalog-first-v150.js`: the same for the catalog-first playlist path, plus duplicate detection for unresolved recordings.
- `apple-album-import-v150.js`: the same rule for albums.
- Expose the core's local recording id so an adapter can locate an unresolved recording it just imported.
- Report matched and unresolved counts in the import status.
- Start playback from the first track that is actually playable.

## Non-goals

- Changing how a match is found. `apple-match-strict-v150.js` and the MusicKit path are untouched.
- Re-resolving unresolved tracks in the background. Resolution stays on demand, per `unresolved-tracks-v1`.
- Changing the Apple markdown parser's extraction rules.
- Changing the Ámpula format or the sharing flow.
- Making the Apple reader work without `r.jina.ai`.

## Success criteria

- Importing a 5-track playlist where 1 track cannot be matched adds 5 tracks in the original order, and the unmatched one keeps `Crystalised` / `The xx`.
- Importing a playlist where no track can be matched adds every track as unresolved instead of reporting an error.
- Importing a playlist the reader could not extract any track from reports an empty playlist, not `Could not import`.
- A reader HTTP failure is still reported as an error.
- Playback starts on the first playable track, and does not start when nothing is playable.
- Sharing the result produces an Ámpula in which the unresolved tracks keep their Apple identity and carry their Apple URL as an observation.
