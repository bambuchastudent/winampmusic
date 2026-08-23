# Apple Music playlist import

## Requirement: route public Apple Music playlists
When the existing AmpMusic 1.5 import field receives a public `music.apple.com/<storefront>/playlist/.../<playlist-id>` URL, the client SHALL treat it as a playlist import, not as an unsupported Apple track URL.

## Requirement: import ordered playable matches
The client SHALL discover the playlist's ordered track metadata, resolve each track to a playable YouTube video using the existing client-side matcher, and import successful matches in the same order. An individual unresolved track SHALL NOT fail the whole playlist.

## Requirement: keep local-first behavior
No AmpMusic backend or centralized music storage is required. The Apple URL remains source context; playback uses locally resolved YouTube video IDs.

## Requirement: preserve current 1.5 flows
YouTube track import, YouTube playlist import, and Apple Music single-track import SHALL continue to work through the same field. Public product version SHALL remain 1.5.

## Regression example
`https://music.apple.com/tr/playlist/thexx/pl.u-V9D7mR7TaB8Zkl` SHALL be recognized as an Apple Music playlist URL and SHALL enter the playlist import flow.
