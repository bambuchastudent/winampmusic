# Design: Apple origin vs playback

## Data model
Apple-derived tracks keep backward-compatible fields (`sourceUrl`, `appleTrackId`) and add explicit provenance fields:

- `originProvider: "Apple Music"`
- `originStorefront: "TR"` (or parsed storefront)
- `originUrl: <exact pasted Apple URL>`
- `playbackProvider: "YouTube"` when a strict match exists
- `playbackState: "candidate"` until the player confirms playback

The Apple URL describes where the music was observed. It MUST NOT be interpreted as a browser-audio source.

## Import result
The Apple import handler returns structured state while remaining truthy for handled URLs:

- `handled`
- `matched`
- `playbackVerified`
- `storefront`
- `originUrl`

The fast import UI uses this state instead of assuming that a successful match is already playing.

## Player UI
Add a dedicated provenance line below artist. For Apple-origin tracks it renders one of:

- `Origin · Apple Music (TR) · Playback · YouTube candidate`
- `Origin · Apple Music (TR) · Playing · YouTube`
- `Origin · Apple Music (TR) · No playable source in AMP`

Playback status remains operational (`PLAYING`, errors, resolving); provenance remains descriptive and persistent.

## Compatibility
Existing Apple rows without the new fields are inferred from `sourceUrl`/`appleTrackId`. Existing YouTube rows remain unchanged.
