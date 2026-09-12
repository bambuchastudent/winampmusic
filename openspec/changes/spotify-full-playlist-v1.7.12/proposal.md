# Complete Spotify playlist import v1.7.12

## Problem
A public Spotify playlist can contain more tracks than the primary metadata adapter returns in one successful response. The current importer treats any successful primary response as complete, so a truncated 100-track payload is imported as if the playlist ended there. The existing Spotify Web API fallback already paginates, but it only runs after a primary error.

The production Better Call Saul playlist `3A4l0emm89zzee5bzE7E0L` currently has 160 tracks while AMPULAMP imports only the first 100.

## Goal
Treat a suspiciously capped primary response as incomplete metadata and use the existing paginated Spotify Web API path to complete the playlist before importing it.

## Scope
- detect primary responses that are demonstrably or plausibly truncated at the 100-track boundary;
- use the existing anonymous-token + Spotify Web API pagination path to read the complete ordered playlist, up to the existing 500-track safety cap;
- if completion fails, preserve the readable primary rows rather than turning a partial-but-usable import into a hard failure;
- keep Spotify title / artist / origin as canonical identity and keep playback resolution separate.

## Non-goals
- no Spotify playback changes;
- no YouTube matching changes;
- no increase to the existing 500-track client cap;
- no rewrite of source metadata from playback candidates.

## Success
A 160-track playlist whose primary adapter exposes only the first 100 imports all 160 tracks in order, while a failed completion attempt still leaves the primary readable rows importable.