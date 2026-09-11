# Spotify playlist import fallback v1.7.2

## Problem
The public Spotify metadata adapter currently depends on a single `spotify.xwolf.space/api/playlist/:id` request wrapped by a 12 second outer timeout. A slow or stalled scraper request leaves an otherwise public playlist unimportable and shows `Spotify playlist read timed out`.

## Change
Keep wolfX as the primary metadata adapter, but fail over to the provider's documented anonymous token endpoint and Spotify Web API when the primary playlist request times out or fails.

The fallback reads playlist identity and paginated track metadata only. It does not use Spotify as playback, does not change canonical title/artist/origin metadata, and does not resolve YouTube during import.

## Success
A public Spotify playlist imports when the primary wolfX playlist endpoint is unavailable but `/api/token` plus Spotify Web API are available. Existing fast-path behavior remains unchanged.