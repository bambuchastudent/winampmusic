# Proposal: manual playback miss recovery v1.7.3

## Problem

A canonical Spotify/Apple track can still have a stale or simply wrong YouTube playback candidate loaded in the hidden player. The UI can already know that the candidate is not trustworthy while the wrong audio keeps playing. Users also need a direct way to say “this playback match is wrong” without deleting or rewriting the canonical track.

## Goal

Add a compact Winamp-style `MISS` control beside the player status. Pressing it rejects only the current YouTube playback candidate, stops it immediately, keeps the canonical title/artist/origin untouched, and searches again while excluding locally rejected candidate IDs. If no alternate candidate is trustworthy, keep the recording unresolved and continue to the next playable track.

## Scope

- persistent local rejected-candidate IDs keyed by canonical recording metadata;
- compact `MISS` button in the player status row;
- current YouTube playback stops before retry;
- rejected IDs are excluded from subsequent matcher ranking;
- successful replacement still must pass the existing final trust gate;
- canonical recording metadata and origin stay unchanged;
- if retry fails, advance through later library rows until a playable track is found.

## Non-goals

- no provider-specific hardcoded song/video mappings;
- no mutation of Spotify/Apple identity;
- no deletion of the canonical recording from the library;
- no weakening of duration/title/artist trust rules.

## Success criteria

1. Rejecting a wrong YouTube candidate stores that video ID locally for the recording and stops playback immediately.
2. The recording remains in the same library slot with the same title, artist and origin metadata.
3. A retry cannot select an ID already rejected for that recording.
4. A replacement candidate cannot play unless the existing final trust gate accepts it.
5. If no replacement exists, playback advances to the next playable library track.
6. The `MISS` button shows how many candidates have been rejected for the current recording.