# Proposal: YouTube.js-only playback mode

## Problem

Production playback can silently fall through to the existing YouTube iframe path, making it impossible to prove that YouTube.js itself produced the audio. FAST can also continue an already-started iframe directly without calling the wrapped `window.playIndex`.

## Goal

Add an explicit playback-isolation mode that disables every iframe fallback and forces YouTube tracks through YouTube.js only.

## Activation

`?playback=youtubejs`

Removing the parameter restores normal provider/fallback behavior.

## Scope

- block FAST iframe creation, warming, resume, and direct playback in isolation mode;
- make YouTube.js own Play while isolation mode is active;
- disable iframe retry/fallback modules in isolation mode;
- expose the actual YouTube.js error in the visible status when resolution or native playback fails;
- keep normal playback unchanged without the parameter.

## Non-goals

- no change to Ámpula identity;
- no YouTube login;
- no permanent removal of iframe fallback from normal mode.

## Success criteria

In production with `?playback=youtubejs`, a playable YouTube track either reaches `PLAYING · YOUTUBEJS · AUDIO` with advancing elapsed time or shows a `YOUTUBEJS ERROR`. It must never start or recover through the iframe player.
