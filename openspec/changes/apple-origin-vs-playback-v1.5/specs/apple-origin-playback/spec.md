# Apple origin and playback requirements

## Requirement: Apple web links are origin references
An imported Apple Music URL MUST be preserved as origin metadata. The Apple Music page URL MUST NOT be described or treated as a playable AmpMusic media source.

## Requirement: storefront provenance is preserved
For Apple Music URLs with a two-letter storefront path, AmpMusic MUST preserve and display that storefront (for example `TR`).

## Requirement: matching is not playback
Finding a strict YouTube match MUST NOT cause the import UI to claim that the track is playing. A match is a playback candidate until the player confirms playback.

## Requirement: provenance remains visible
For an Apple-origin track, the player MUST show where the track came from separately from the current playback state.

## Requirement: unavailable playback is specific
If AmpMusic cannot obtain a playable source for an Apple-origin track, the UI MUST say that no playable source is available in AmpMusic while retaining the Apple origin/storefront context.

## Requirement: compatibility
Existing Apple rows using `sourceUrl` and `appleTrackId` MUST continue to render provenance. Ordinary YouTube imports MUST remain unchanged.
