# Winamp Music

A tiny mobile-first web player for music you already keep in YouTube playlists.

## MVP flow

1. Open the deployed Winamp Music site.
2. Press **Import** and copy `youtube-import.js`.
3. Open a YouTube playlist or **Liked videos** on `youtube.com`.
4. Open DevTools → Console, paste the importer, and press Enter.
5. The importer opens Winamp Music immediately, scrolls the current YouTube list, extracts rendered video metadata, and sends it to the player with `window.postMessage`.
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
- Media Session handlers where the browser supports them;
- installable PWA shell;
- GitHub Pages deployment workflow from `develop`.

## Architecture

```text
YouTube tab
  youtube-import.js
      |
      | scans rendered playlist rows
      | opens player early (avoids popup blocking)
      v
postMessage({ type: WINAMP_MUSIC_IMPORT, tracks })
      |
      v
Winamp Music (GitHub Pages)
  app.js
      |
      +--> localStorage library
      |
      +--> YouTube IFrame Player
      |
      +--> Media Session API
```

The player accepts imports only from explicit YouTube origins and normalizes every imported track before storing it.

## Deploy

The repository default branch is `develop`. The included Pages workflow deploys on every push to `develop`.

In GitHub repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions** once. The intended production URL is:

`https://bambuchastudent.github.io/winampmusic/`

## Current limitations

- Import currently reads the playlist/list that is open in the browser; it does not query the entire account through OAuth/API.
- YouTube can change its DOM selectors, so the importer is deliberately isolated in `youtube-import.js`.
- Background playback depends on browser/OS/YouTube behavior. The app exposes Media Session controls where available but does not bypass platform restrictions.
- Tracks that cannot be embedded are skipped automatically when playback returns an error.

## Next sensible capabilities

- a one-click bookmarklet/import helper instead of manually pasting the full script;
- importing several playlists while preserving playlist/group metadata;
- queue, repeat, favorites, and manual ordering;
- export/import of the local library as JSON;
- optional YouTube Data API OAuth mode for account-wide library sync.

This project is an independent experiment and is not affiliated with YouTube or Winamp.
