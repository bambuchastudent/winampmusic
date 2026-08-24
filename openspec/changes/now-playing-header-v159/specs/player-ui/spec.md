# Player UI delta

## Requirement: Now Playing reflects actual playback

ÁmpulaMP MUST keep the visible Now Playing title and artist bound to the source that is actually playing. A newly imported track MUST NOT replace those fields merely because source resolution has started.

### Scenario: Apple import while another track plays

Given a YouTube-backed track is currently playing
When the user imports an Apple Music track and ÁmpulaMP attempts to resolve a playable source
Then the current track continues to be shown in Now Playing until the new source is successfully resolved and playback is ready to switch.

### Scenario: imported Apple track is not playable

Given another track is currently playing
When an imported Apple Music track cannot be resolved to a playable source
Then the existing track continues playing
And its title and artist remain in Now Playing
And the Apple item remains saved with provenance information in the library.

## Requirement: compact brand/repository affordances

The header MUST display a clickable bottle immediately before the `Ámpula MP` product name. The bottle and footer version MUST link to the repository. The old square repository button MUST NOT be displayed.

### Scenario: open repository from brand

When the user clicks the bottle or footer version
Then the ÁmpulaMP repository opens in a new tab.

## Requirement: playback visualization

The header SHOULD display a compact equalizer/spectrum-style indicator in the former right-side bottle position. It MUST remain decorative and MUST NOT block or control playback.

### Scenario: playback state changes

When playback becomes active
Then the spectrum bars animate
And when playback pauses or stops
Then the bars settle to an idle state.
