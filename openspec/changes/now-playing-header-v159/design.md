# Design

## Ownership

- `import-playback-guard-v159.js` owns the rule that background imports cannot steal active playback.
- Existing provider adapters continue to own explicit playback/source resolution.
- `index.html` owns product header/footer composition.
- `header-visualizer-v159.js` owns only decorative playback-state visualization and must not own playback events.

## Import/playback transition

The import adapter captures whether playback is already active before delegating to Apple track/album/playlist import APIs. If something is playing, the import is delegated with `play: false`: metadata is saved, but the importer does not invoke a provider switch and therefore cannot replace Now Playing.

If nothing is playing, the caller's normal `play` intent is preserved, so `Add & Play` still behaves as before on an idle player.

The guard also re-patches lazily loaded Apple import APIs after their script `load` event so it remains effective with the existing lazy provider architecture.

## Header layout

The brand row contains a small clickable bottle followed by `Ámpula MP`. The previous square external-link control is removed. The footer version is an understated repository link. The old right-side bottle position becomes a bounded spectrum panel.

## Visualization

The spectrum is a visual playback indicator with several independent bands. Because the dominant YouTube playback path is provider-hosted/iframe audio and cannot expose raw cross-origin audio samples to Web Audio, it must not claim measured FFT data. It animates from playback state only. Direct/local audio can be wired to real analysis later without changing the UI contract.

## Failure modes

- If visualization JS fails, playback and controls remain unaffected.
- If an import cannot resolve a playable source while another track is active, the current playback remains untouched and the imported item stays in the library with provenance.
- If the user has no active playback, bars remain in their idle state.
