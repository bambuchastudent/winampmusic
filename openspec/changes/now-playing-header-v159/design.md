# Design

## Ownership

- `clean-playback-v150.js` owns direct-source resolution and transition from the currently playing provider to a resolved direct source.
- `index.html` owns product header/footer composition.
- `header-visualizer-v159.js` owns only decorative playback-state visualization and must not own playback events.

## Playback transition

Direct playback becomes transactional. Resolve the requested track's exact video/source payload and audio stream first. Only after a playable stream exists may the adapter pause the currently playing legacy source, update Now Playing, and start the replacement audio.

If resolution fails, do not call `updateNow`, do not change the saved current index, and do not pause the existing legacy player. The import/provenance UI may still report that the newly added Apple item has no playable source.

## Header layout

The brand row contains a small clickable bottle followed by `Ámpula MP`. The previous square external-link control is removed. The footer version is an understated repository link. The old right-side bottle position becomes a bounded spectrum panel.

## Visualization

The spectrum is a visual playback indicator with several independent bands. Because the dominant YouTube playback path is provider-hosted/iframe audio and cannot expose raw cross-origin audio samples to Web Audio, it must not claim measured FFT data. It animates from playback state only. Direct/local audio can be wired to real analysis later without changing the UI contract.

## Failure modes

- If visualization JS fails, playback and controls remain unaffected.
- If direct source resolution fails, existing playback remains untouched.
- If the user has no active playback, bars remain in their idle state.
