# Spotify playlist embed import

## Problem
AMPULAMP accepts YouTube and Apple Music sources from the unified music entry, but a pasted Spotify playlist cannot currently be opened as a playable source without leaving the player.

## Goal
Recognize Spotify playlist URLs in the unified music entry and open the public playlist inside AMPULAMP using Spotify's official Embed/IFrame API, without requiring a Spotify Web API client secret or mutating Ámpula Core.

## Scope
- Accept `https://open.spotify.com/playlist/<id>` URLs.
- Accept the known shared Google wrapper `https://share.google/T0seuEuCz8Wdpksp3` as an alias for the Better Call Saul playlist `3A4l0emm89zzee5bzE7E0L`.
- Render the Spotify playlist as an optional provider panel below the core player.
- Keep the existing YouTube/Apple playback and local library critical path unchanged.
- Persist the last Spotify playlist source locally so refresh restores the panel.

## Non-goals
- Copy Spotify catalogue metadata into Ámpula Core.
- Download Spotify audio.
- Scrape Spotify pages.
- Use Spotify Web API playlist-items endpoints.
- Convert every Spotify track to YouTube automatically in this change.

## Success criteria
- Pasting a supported Spotify playlist URL into the main music field opens the playlist embed and clears the input.
- The Better Call Saul shared link resolves to playlist `3A4l0emm89zzee5bzE7E0L`.
- The Spotify panel can be closed without affecting the local library or current YouTube/Apple playback.
- The implementation uses Spotify's documented Embed/IFrame API and is outside the critical startup path.
