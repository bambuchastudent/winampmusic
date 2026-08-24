# Ámpulamp

**Ámpulamp — Music Player for sharing moments through music.**

Ámpulamp is a player for selecting tracks from your music library, preserving that selection as a portable musical moment, and sending it to another person.

That transferable object is called an **Ámpula** and is stored as a **`.ampula`** file. The recipient can keep it, open it now or later, and Ámpulamp attempts to reconstruct the intended listening experience from music sources available to them.

The ending **MP** in **Ámpulamp** means **Music Player**.

See [`AMPULA_SPEC.md`](./AMPULA_SPEC.md) for the canonical product definition and naming rules.

> `winampmusic` is the legacy repository name. The product/player name is **Ámpulamp**; **Ámpula** is the portable musical moment.

## Current MVP

The current implementation is a mobile-first web player focused primarily on music imported from YouTube playlists, while the product direction is provider-independent Ámpula creation, transfer and recovery.

## MVP flow

1. Open the deployed player site.
2. Press **Import** and copy `youtube-import.js`.
3. Open a YouTube playlist or **Liked videos** on `youtube.com`.
4. Open DevTools → Console, paste the importer, and press Enter.
5. The importer opens Ámpulamp immediately, scrolls the current YouTube list, extracts rendered video metadata, and sends it to the player with `window.postMessage`.
6. The player deduplicates tracks by YouTube video ID and stores the library in browser `localStorage`.
7. Pick a track and play it through the embedded YouTube IFrame Player.

No backend, OAuth token, YouTube password, audio download, or re-hosting is used in this MVP.

## What is included

- mobile-first retro player UI;
- playlist / Liked videos importer for YouTube and basic YouTube Music selectors;
- automatic scrolling while importing long lists;
- cross-origin import transport through `window.postMessage`;
- local persistent library with deduplication;
- search, play/pause, previous, next, random track, seek, and volume;
- YouTube IFrame playback with a visible video surface;
- v1.1 background mode with Media Session metadata and system play/pause/previous/next/seek controls where supported;
- playback snapshots before the page is hidden, frozen, or unloaded;
- one-tap resume from the saved position when a mobile browser suspends embedded playback;
- installable PWA shell;
- GitHub Pages deployment workflow from `develop`.

## Architecture

```text
Music source / library
        |
        | import / resolve
        v
Ámpulamp
  app.js
      |
      +--> local library + playback snapshots
      |
      +--> source-specific playback adapters
      |
      +--> Media Session API / system controls
      |
      +--> .ampula create / open / recover   (product direction)
```

The current YouTube importer accepts imports only from explicit YouTube origins and normalizes every imported track before storing it.

## Ámpula direction

A `.ampula` should preserve the musical moment rather than merely save one provider URL.

Provider URLs, service IDs and catalog matches are recovery hints/provenance. They are not the source of truth for the track. When an Ámpula is opened later, Ámpulamp should resolve the recording against sources available to the recipient.

This keeps sharing centered on **the tracks and the moment**, rather than on whether both people use the same streaming provider.

## Deploy

The repository default branch is `develop`. The included Pages workflow deploys on every push to `develop`.

In GitHub repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** once. The intended production URL is:

`https://bambuchastudent.github.io/winampmusic/`

## Background playback in v1.1

Ámpulamp does not intentionally pause playback when the page becomes hidden. On browsers and operating systems that allow the embedded YouTube player to remain active, audio can keep playing while the PWA is in the background and Media Session exposes controls in the system media UI.

If the browser or OS suspends the page or pauses the YouTube iframe, v1.1 stores the current track and position and offers a one-tap resume when the app becomes active again. If the browser process or tab is fully closed, a web page cannot keep the iframe running; reopening the app restores the saved session instead of pretending playback continued.

## Current limitations

- `.ampula` creation/opening/recovery is the target product model and is not fully implemented by the current MVP yet.
- Import currently reads the playlist/list that is open in the browser; it does not query the entire account through OAuth/API.
- YouTube can change its DOM selectors, so the importer is deliberately isolated in `youtube-import.js`.
- True background playback still depends on browser/OS/provider behavior; v1.1 uses supported Media Session and session-resume mechanisms and does not bypass platform restrictions.
- A future Ámpula can only be played when the relevant recording can still be resolved from a source available to the recipient.

## Next sensible capabilities

- define the versioned `.ampula` schema;
- create/export an Ámpula from the current track selection/order;
- open/import `.ampula` files and preserve their original ordering/context;
- resolve tracks independently of the provider used when the Ámpula was created;
- expose source/provenance and playback availability clearly to the user;
- continue improving library import, queue, repeat, favorites, and ordering.

## Product boundaries

Ámpulamp is not intended to become a streaming service, a centrally hosted music catalog, a mandatory social network, or a replacement for Apple Music, YouTube, Spotify or other providers. Those services are sources that Ámpulamp may use to recover/play a musical moment.

This project is an independent experiment and is not affiliated with YouTube, Apple Music, Spotify or Winamp.