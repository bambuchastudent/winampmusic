# Tasks

- [ ] Remove the external Apple Music source-URL routing from the production page.
- [ ] Keep Apple track/album/playlist import inside AmpMusic.
- [ ] Add lazy MusicKit-on-the-Web playback using Apple catalog song IDs when configured.
- [ ] Keep the current strict YouTube/direct-audio path as the in-player fallback.
- [ ] Ensure failed Apple playback never calls `window.open` or navigates to `music.apple.com`.
- [ ] Bridge play/pause/seek/volume and library navigation while MusicKit owns playback.
- [ ] Generate the public developer token at Pages deploy time from GitHub secrets without exposing the private key.
- [ ] Add regression coverage for source priority, no external navigation, and deploy configuration.
- [ ] Keep AmpMusic public version at 1.5 and preserve the current UI.