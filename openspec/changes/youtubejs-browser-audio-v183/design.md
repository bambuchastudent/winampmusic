# Design

## Request path

`track identity -> YouTube playback handle -> YouTube.js/web -> anonymous HTTPS relay -> InnerTube/player -> deciphered audio URL -> relay -> persistent HTMLAudioElement`

The relay is transport only. It never becomes track identity and it receives no account credentials.

## Browser relay

YouTube.js upstream requires browser requests to be proxied. The adapter supplies a custom `fetch` to `Innertube.create()`. Only YouTube-owned request hosts required by the resolver are accepted. Cookie, Authorization, proxy-authorization, and account-selection headers are stripped; browser requests use `credentials: omit`.

The zero-configuration deployment uses `https://seep.eu.org/`, the public deployment of the MIT-licensed `netnr/proxy` CORS-anywhere implementation. Its source supports proxied request methods and forwards response bodies; a live GET against YouTube is part of implementation validation. This public relay is a replaceable transport dependency, not part of Ámpula Core. A first-party restricted relay remains the preferred production hardening path when deployment credentials are available.

The final Googlevideo media URL is also routed through the same relay. This keeps the media request on the same network path as resolution and exposes CORS/Range responses to the native audio element.

## YouTube.js web runtime

The browser imports the pinned `youtubei.js@18.0.0/web` build. A custom interpreter is installed through `Platform.shim.eval` as required for deciphering streaming URLs. The session is generated locally to reduce unnecessary bootstrap requests.

## Audio and user activation

The resolver calls `getStreamingData(videoId, { type: 'audio', quality: 'best' })`. Only the resulting short-lived audio URL is assigned to the persistent native `Audio` element.

At the start of the initiating user gesture the same audio element is synchronously primed with a tiny generated silent WAV and kept playing while resolution runs. This establishes native media playback under the user gesture before asynchronous YouTube.js work. Once resolution succeeds, the same element switches to the proxied audio URL and normal volume.

## Failure

Any relay, resolver, decipher, or native-media failure produces `YOUTUBE · FALLBACK` and delegates to the existing iframe player. Failure never rewrites title, artist, origin, source URL, or received Ámpula evidence.

A successful direct path displays `PLAYING · YOUTUBEJS · AUDIO` only after `audio.play()` succeeds.
