# Proposal: Unresolved tracks are first-class library tracks

## Problem

In the working library a track only exists if it carries an 11-character YouTube video id.

- `fast-player-v141.js` `importTracks` skips every incoming item whose `id` does not normalize to a YouTube id.
- `readLibrary` and `importTracks` manufacture `YouTube <id>` and `YouTube` when title/artist are missing, so a provider handle is written into the fields that carry musical identity.

Three user-visible consequences follow.

1. An Apple Music playlist whose tracks are no longer matchable imports as an empty library, even though readable title/artist metadata was fetched and then discarded.
2. `Add playable tracks` from a Received Ámpula can only ever offer the tracks the resolver matched, because the library has nowhere to put the others.
3. Sharing re-encodes the manufactured placeholders: `compact-share.js` `toAmpula` copies `track.title`/`track.artist` into Core v1 `title`/`artists`, producing `{"title": "YouTube dQw4w9WgXcQ", "artists": ["YouTube"]}`. That contradicts the canonical format rules in `ampula/README.md` and `AGENTS.md` — provider identifiers are observations, never identity — and it actively degrades the receiver's resolver, which would search for the literal string `YouTube dQw4w9WgXcQ`.

The same limitation blocks any source that knows a recording but no provider item, which is the normal shape of a Telegram or plain-text import.

## Goal

Make recording identity provider-independent inside the working library, matching the Ámpula Core v1 domain.

- A track is identified by human-readable `title` and `artist`.
- A provider id is an optional playback handle, not a precondition for existence.
- A track with identity but no playable handle is an ordinary, visible, orderable library track.
- Nothing manufactures provider-shaped strings into stored identity.

## Scope

- Accept identity-only tracks in `importTracks` and assign them a deterministic local recording id.
- Stop persisting `YouTube <id>` / `YouTube` as title/artist in the core and in the importers that feed it.
- Render missing metadata as a display fallback instead of storing invented identity.
- Mark unresolved tracks in the library list.
- Resolve an unresolved track on demand through the existing title/artist repair search, and persist that match as local state.
- Adopt a playable handle into an existing unresolved recording instead of creating a duplicate row.

## Non-goals

- Changing the Ámpula Core v1 format, its schema, or the `?a=` transport.
- Building the full `ampula/RESOLVER.md` profile as a module. This change only stops the domain from destroying unresolved tracks.
- Making Apple import return partial results. That is `apple-playlist-resilience-v1`.
- Changing what `Add playable tracks` adds from a Received Ámpula. `ampula-open-format-v1/design.md` decided that action "may add only tracks for which the current runtime has a usable playback representation". This change makes the library *able* to hold the rest; whether the received action should offer them is a separate decision for the sharing capability.
- Auto-skipping unresolved tracks during sequential playback.
- Any Telegram import behaviour.
- Migrating existing stored libraries. Legacy rows keep their stored ids.

## Success criteria

- `importTracks([{ title: 'Teardrop', artist: 'Massive Attack' }])` adds one track, and the library reports 1.
- Importing the same recording twice, once without and once with a YouTube id, results in one track that ends up playable.
- No code path writes a string containing a provider id into a stored `title` or `artist`.
- A stored unresolved track never reaches `loadVideoById`.
- Sharing a library that contains an unresolved track produces a Core v1 object whose track keeps its real title/artists and carries no fabricated `youtube` observation.
- `tests/performance-v150.mjs` still passes, including the synchronous core source budget.
