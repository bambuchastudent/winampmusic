# Proposal: Native Ámpula sharing and receiving

## Problem

The current playlist-sharing flow serializes a playlist as a URL parameter containing only provider-specific track IDs. On receipt, those IDs are imported directly into the receiver's local library. This loses the musical moment's metadata and context, produces placeholder entries such as `YouTube <id>`, and mutates an existing library just by opening a shared link.

That behavior conflicts with the Ámpula model: a shared object is a portable musical moment, not a provider-ID list and not an implicit library import.

## Goal

Make sharing transfer a complete Ámpula object and make receiving non-destructive by default.

A receiver must be able to:

1. open the received Ámpula as its own temporary context;
2. see the same ordered musical moment with preserved metadata and provenance;
3. play it using whatever sources can be resolved locally;
4. explicitly save the received Ámpula to their own local Ámpula collection;
5. optionally add tracks to the general library only through a separate explicit action.

## Scope

- Replace ID-list sharing with a versioned Ámpula payload.
- Remove the legacy `?p=<provider-id>...` share/receive contract.
- Preserve ordered tracks, human-readable metadata, provenance/source hints, provider identifiers/URLs, and the intended start track.
- Introduce a distinct `Received Ámpula` runtime state that does not mutate `Your library`.
- Introduce an explicit `Save Ámpula` action that persists the received object locally.
- Keep playback-source resolution separate from the Ámpula identity.
- Keep transport replaceable: link, QR, and `.ampula` file must all resolve to the same domain object.

## Non-goals

- Building a hosted music catalog.
- Making any streaming provider the source of truth.
- Requiring a centralized backend for the core Ámpula format.
- Automatically copying received tracks into `Your library`.
- Preserving compatibility with old `?p=` links.
- Solving every future resolver strategy in this change.

## Success criteria

- A shared 18-track Ámpula opens as exactly 18 ordered tracks with preserved title/artist metadata instead of `YouTube <id>` placeholders.
- Opening a shared Ámpula on a device with an existing 40-track library leaves those 40 tracks unchanged.
- The receiver can explicitly save the Ámpula and reopen it later from local storage.
- Saving an Ámpula preserves the received musical moment; it does not replace the object with whichever provider URLs happened to work during playback.
- Provider URLs and IDs remain provenance/resolution hints rather than the Ámpula identity.
- No runtime path generates or consumes the legacy `?p=` payload after this change ships.
