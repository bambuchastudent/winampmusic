# Tasks

- [x] Remove the external Apple Music source-URL routing from the production page.
- [x] Keep Apple track/album/playlist import inside AmpMusic.
- [x] Add lazy MusicKit-on-the-Web playback using Apple catalog song IDs when configured.
- [x] Keep the current strict YouTube/direct-audio path as the in-player fallback.
- [x] Ensure failed Apple playback never calls `window.open` or navigates to `music.apple.com`.
- [x] Bridge play/pause/seek/volume and library navigation while MusicKit owns playback.
- [x] Generate the public developer token at Pages deploy time from GitHub secrets without exposing the private key.
- [x] Add regression coverage for source priority, no external navigation, and deploy configuration.
- [x] Keep AmpMusic public version at 1.5 and preserve the current UI.