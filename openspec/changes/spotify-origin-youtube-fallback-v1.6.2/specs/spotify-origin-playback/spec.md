# Spotify origin and playback

## Requirement: no visible Spotify player

When a Spotify playlist link is imported, Ámpula MP MUST keep its normal player UI and MUST NOT render a Spotify Embed panel or Spotify iframe.

## Requirement: playlist becomes library tracks

For each readable Spotify playlist item, Ámpula MP MUST retain the Spotify track title and artist plus the Spotify track ID/URL and source playlist ID/URL. The playlist title and owner SHOULD be retained when available.

Spotify preview URLs MUST NOT be selected as the primary playback source.

## Requirement: resolve playable source

Ámpula MP SHOULD resolve imported Spotify-origin tracks to a matching YouTube recording in the background using title, artist and duration. A successful playback match MUST NOT overwrite the Spotify-origin title, artist or backlink.

If background resolution is not complete when the user starts a track, the normal unresolved-track playback repair MAY resolve it on demand.

## Requirement: provenance is explicit

For a Spotify-origin track played via YouTube, the player MUST expose both facts, equivalent to `Origin · Spotify · Playing · YouTube`.

Re-importing the same Spotify playlist MUST NOT create duplicate tracks solely because a YouTube match was later attached.
