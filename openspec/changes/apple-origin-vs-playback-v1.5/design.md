# Design: Apple origin vs playback

## Existing data is enough
Apple-derived rows already preserve the exact pasted Apple URL in `sourceUrl` and the Apple song id in `appleTrackId`. This change intentionally avoids a storage migration: provenance is derived from those existing fields and the storefront is parsed from the Apple URL path (`/tr/` -> `TR`).

The Apple URL describes where the music was observed. It MUST NOT be interpreted as a browser-audio source.

## Import wording
The existing Apple importer may know that a strict YouTube candidate was found before any audio starts. The UI therefore treats matching and playback as separate states:

- match found -> playback candidate, not playing;
- player confirms playback -> playing from the confirmed provider;
- player fails -> no playable source in AmpMusic, while origin remains visible.

A small provenance bridge observes the existing import/player status and corrects misleading legacy wording without changing Apple/YouTube matching behavior.

## Player UI
A dedicated provenance line is inserted below the artist for Apple-origin tracks. It renders one of:

- `Origin · Apple Music (TR) · Playback · YouTube candidate`
- `Origin · Apple Music (TR) · Playing · YouTube`
- `Origin · Apple Music (TR) · Playing · Apple Music`
- `Origin · Apple Music (TR) · No playable source in AMP`

The operational status line remains separate. Legacy `TRACK UNAVAILABLE · STAYING IN AMP MUSIC` is translated to `NO PLAYABLE SOURCE IN AMP · APPLE ORIGIN PRESERVED` for Apple-origin tracks.

## Compatibility
Existing Apple rows work immediately because provenance is inferred from `sourceUrl`/`appleTrackId`. Ordinary YouTube rows and import/playback behavior remain unchanged.
