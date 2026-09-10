# Proposal — Spotify played tracks in Your library

## Problem
Spotify playlists can play inside the official Spotify Embed, but tracks actually heard there are not retained in `Your library`, and the relationship to the source Spotify playlist is lost.

## Goal
When a Spotify track actually starts playing inside the embedded playlist, retain that recording in the local library together with the Spotify track URL and a backlink to the source playlist.

## Scope
- React only to real Spotify `playback_started` track events.
- Resolve basic track display metadata through Spotify oEmbed.
- Save the played track into the existing local library without bulk-importing untouched playlist entries.
- Preserve the Spotify track id/url and source playlist id/url/title/owner as provider provenance.
- Avoid duplicates for repeated playback of the same Spotify track.
- Keep Spotify as the active playback surface while the playlist embed is open.

## Non-goals
- Copy the entire Spotify playlist into the local library up front.
- Download or re-host Spotify audio.
- Require Spotify Web API OAuth for this feature.
- Put Spotify-specific identifiers into Ámpula Core identity.

## Success criteria
A Spotify playlist can keep playing in its embed, each track that actually starts is represented once in `Your library`, and the saved entry retains both a Spotify track link and its originating playlist link.