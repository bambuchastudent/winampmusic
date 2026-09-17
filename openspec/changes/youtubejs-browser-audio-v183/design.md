# Design

## Request path

`track identity -> YouTube playback handle -> YouTube.js/web -> anonymous HTTPS relay -> InnerTube/player -> deciphered audio URL -> persistent HTMLAudioElement`

The relay is transport only. It never becomes track identity and it receives no account credentials.

## Browser relay

YouTube.js upstream requires browser requests to be proxied. The adapter supplies a custom `fetch` to `Innertube.create()`. Only YouTube-owned request hosts required by the resolver are accepted. Cookie and authorization headers are stripped before forwarding.

The initial zero-config production relay is `https://corsproxy.io/`, whose documented API supports proxied POST requests. If a first-party relay becomes configured later, the transport can be swapped without changing track identity or queue semantics.

## Audio

The resolver calls `getStreamingData(videoId, { type: 'audio', quality: 'best' })`. The returned short-lived media URL is assigned only to the persistent native `Audio` element.

At the start of the user gesture the same audio element is synchronously primed with a tiny silent media source. This establishes user activation before asynchronous YouTube.js resolution on mobile browsers.

## Failure

Any relay, resolver, decipher, or native-media failure produces an explicit fallback status and delegates to the existing iframe player. Failure never rewrites title/artist/origin.
