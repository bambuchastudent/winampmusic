# Proposal: one music entry, optional library filter

## Problem
The current player exposes three visually competing text inputs: music-link import, YouTube search, and local library filtering. It is not obvious which one should be used for a track, playlist, or existing library item.

## Goal
Make the primary music interaction obvious by presenting one main input for discovering/importing music, while keeping local library filtering available without occupying permanent screen space.

## Scope
- Use the existing top music input as the single primary entry point.
- Accept ordinary artist/track text in that input and route it to the existing YouTube search provider flow.
- Continue accepting supported YouTube and Apple Music track/album/playlist URLs in the same input.
- Remove the separate visible YouTube search card.
- Hide the local `Your library` filter by default and expose it through a small search toggle next to the library heading.
- Preserve the existing local-library filter behavior once expanded.

## Non-goals
- No backend or account requirement.
- No change to playback-source selection.
- No removal of local filtering.
- No provider-specific catalog becoming the product identity.

## Success criteria
- The normal screen shows one obvious music text field.
- Text such as an artist/title starts music search from that field.
- A supported provider URL continues to import/play through the existing import path.
- The library filter is hidden initially and can be opened/closed with a search icon.
