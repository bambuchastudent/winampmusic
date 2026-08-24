# Ámpula

**Ámpula** is a project for passing a musical moment through music.

**ÁmpulaMP** is the player that creates, opens, restores, and plays those moments. The ending **MP** means **Music Player**.

A musical moment is transferred as a **`.ampula`** file: an ordered track selection plus enough identity and source context for the player to try to reconstruct the intended listening experience now or later.

> `winampmusic` is the legacy repository and GitHub Pages path. It is infrastructure, not the product name. The project is **Ámpula** and the player is **ÁmpulaMP**.

## Product idea

Ámpula is not another streaming service. The point is to make a moment and its tracks from your library easy to pass to another person and meaningful to reopen later.

A `.ampula` preserves the moment and ordered track selection. Provider URLs and service IDs are useful source/recovery information, but they are not the product itself and must not be treated as proof that a track is playable.

The source used when a `.ampula` is created may differ from the source used when it is played later. ÁmpulaMP resolves recordings against sources available to the recipient.

## Current MVP

The current implementation is a mobile-first web player focused primarily on music imported from YouTube and Apple Music links, while the product direction is provider-independent `.ampula` creation, transfer, recovery, and playback.

## MVP flow

1. Open ÁmpulaMP.
2. Use the single music field to search by artist/track name or paste a supported YouTube or Apple Music track, album, or playlist link.
3. ÁmpulaMP searches or imports the available track metadata into the local library. If music is already playing, background imports do not steal the visible Now Playing state or interrupt the current track.
4. Pick a track and play it through an available playback source.
5. Use the small search control in `Your library` only when you want to filter music already saved locally.
6. Share the current selection by link/QR today; the portable product format is `.ampula`.

The player is designed so provider integrations remain playback/import/resolution sources rather than the identity of the musical moment.

## What is included

- mobile-first player UI;
- one primary music field for text search and YouTube / Apple Music link import;
- local persistent library with an optional collapsible filter;
- play/pause, previous, next, shuffle, seek, and volume;
- provider-specific playback adapters;
- playback-preserving background imports;
- compact bottle brand/repository link plus a playback-state spectrum indicator;
- Media Session integration and playback snapshots where supported;
- playlist sharing by link / QR;
- installable PWA shell;
- GitHub Pages deployment workflow from `develop`.

## Architecture

```text
Music source / library
        |
        | import / resolve
        v
ÁmpulaMP
        |
        +--> local library + playback snapshots
        |
        +--> source-specific playback adapters
        |
        +--> Media Session API / system controls
        |
        +--> .ampula create / open / recover
```

## `.ampula`

A `.ampula` is the portable representation of a musical moment. It should remain useful even if the provider originally used to select a recording later disappears or becomes unavailable to the recipient.

Provider URLs, catalog IDs, and matches are provenance and recovery candidates. They are not the canonical identity of the moment, and storing one does not mean that source is currently playable.

## Deploy

The repository default branch is `develop`. The included Pages workflow deploys on every push to `develop`.

While the GitHub repository keeps its legacy slug, the production URL remains:

`https://bambuchastudent.github.io/winampmusic/`

## Background playback

ÁmpulaMP does not intentionally pause playback when the page becomes hidden. On browsers and operating systems that allow the active provider player to remain alive, Media Session exposes supported system controls.

If the browser or OS suspends the page or player, ÁmpulaMP stores playback state and can restore the saved session when the app becomes active again. Web-platform/provider restrictions still apply.

## Product boundaries

Ámpula is not intended to become:

- a new streaming service;
- a centralized hosted music catalog;
- mandatory cloud storage for users' music;
- a mandatory social network;
- an application tied to one music provider.

Existing music services are sources that ÁmpulaMP can import, resolve, or play from.

## Next sensible capabilities

- create/open a versioned `.ampula` format;
- portable recording identity and recovery metadata;
- preserve playlist/group/context metadata in transferred moments;
- queue, repeat, favorites, and manual ordering;
- additional provider adapters without changing the core format.

This project is independent and is not affiliated with YouTube, Apple Music, or Winamp.
