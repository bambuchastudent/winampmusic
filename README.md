# Ámpula

**Ámpula** is an open, portable format for passing a musical moment through music.

The player in this repository is a reference client that can collect music from available services, create an Ámpula, open one, resolve playable representations locally, and play them.

> `winampmusic` is the legacy repository and GitHub Pages path. It is infrastructure, not the musical format.

## What an Ámpula is

An Ámpula is a small ordered description of the recordings somebody intended to pass on. It is deliberately independent of the streaming service used when it was created.

A minimal track needs human-readable `title` and `artists`. Optional evidence can include duration, album/version information, ISRC, MusicBrainz recording ID, fingerprint data, cues, and historical provider observations.

Provider URLs and provider-specific IDs are **observations/recovery hints**, not canonical recording identity and not a promise that the same provider will still be usable later.

The canonical human-readable representation is a UTF-8 **`.ampula` JSON file**. The schema and protocol documentation live under [`ampula/`](./ampula/README.md).

## Current flow

1. Search for music or paste a supported YouTube / Apple Music track, album, or playlist link.
2. Keep the working playback library locally in the browser.
3. Press **Share / QR** to turn the current ordered library into Ámpula Core v1.
4. The app creates a **self-contained `?a=` link**. The musical metadata is inside the link; opening it does not require an Ámpula backend, hosted catalog, Pastepile, or short-link service.
5. The same link can be shown as a QR code or the same Core object can be exported as a **`.ampula` file**.
6. A receiver opens a distinct **Received Ámpula** view. Merely opening it does **not** add anything to `Your library`.
7. The receiver can explicitly **Save Ámpula** as a separate local object, play/resolve tracks from locally available sources, or explicitly **Add playable tracks** to the working library.
8. **Open .ampula** accepts a portable file and opens it through the same Received Ámpula flow.

Legacy provider-ID-only share links such as `?p=id.id.id` are not Ámpula v1 and are no longer generated or silently imported.

## Format

Canonical minimal example:

```json
{
  "format": "ampula",
  "version": "1",
  "tracks": [
    {
      "title": "Teardrop",
      "artists": ["Massive Attack"]
    }
  ]
}
```

Core v1 documentation:

- [`ampula/README.md`](./ampula/README.md) — semantics and boundaries;
- [`ampula/schema/ampula-1.schema.json`](./ampula/schema/ampula-1.schema.json) — JSON Schema;
- [`ampula/URI.md`](./ampula/URI.md) — compact self-contained link/QR transport;
- [`ampula/RESOLVER.md`](./ampula/RESOLVER.md) — provider-independent local resolution profile;
- [`ampula/examples/night.ampula`](./ampula/examples/night.ampula) — readable example.

## Transport

The canonical `.ampula` file and compact link are two representations of the same domain object.

Current web links use:

```text
?a=<encoding>.<payload>
```

The compact payload is base64url compact JSON and uses gzip when the browser supports it and compression makes the link smaller. If compression is unavailable, the app uses the uncompressed self-contained representation instead.

QR encodes that same link. If a payload is too large for a useful QR, the link and `.ampula` file remain valid transports.

## Resolution

Resolution happens on the receiver side and is separate from the received object. A client can use, in roughly this order:

1. local exact files/stable IDs;
2. previous local matches;
3. stable recording identifiers supported by an attached service;
4. historical provider observations;
5. fresh title/artist/album/duration search;
6. fuzzy matching with explicit confidence.

A successful current match must not rewrite the original received evidence. An unresolved track remains part of the Ámpula and remains visible.

## Current player

The current web implementation is mobile-first and currently has the strongest playback/import integrations for YouTube and Apple Music. Those integrations are adapters around Ámpula rather than the format itself.

Included today:

- text search and YouTube / Apple Music link import;
- local persistent working library;
- play/pause, previous, next, shuffle, seek, volume and Radio;
- playback-preserving background imports;
- Media Session integration where supported;
- Ámpula v1 self-contained link sharing;
- QR sharing of the same link;
- `.ampula` export and open;
- non-destructive Received Ámpula context;
- separate local saved-Ámpula collection;
- explicit add-to-library action;
- installable PWA shell;
- GitHub Pages deployment from `develop` after the behavioral verification suite passes.

## Product boundaries

Ámpula is not intended to become:

- a streaming service;
- a centralized hosted music catalog;
- mandatory cloud storage for users' music;
- a mandatory account system or social network;
- an application tied to one provider;
- a container for audio bytes, artwork, lyrics, comments, or provider catalogs in Core v1.

## Deploy

The repository default/deployment branch is `develop`. The Pages workflow runs the full behavioral/contract suite on every push and deploys only after verification succeeds.

Production URL while the repository keeps its legacy slug:

`https://bambuchastudent.github.io/winampmusic/`

This project is independent and is not affiliated with YouTube, Apple Music, Spotify, or Winamp.
