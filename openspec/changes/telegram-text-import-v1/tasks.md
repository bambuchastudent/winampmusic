# Tasks: telegram-text-import-v1

## Specification

- [x] Write `proposal.md` with the problem, goal, scope, non-goals and success criteria.
- [x] Write `design.md` covering ownership, the line grammar, rejections, provenance, UI wiring and
      compatibility.
- [x] Write `specs/telegram-text-import/spec.md` with requirements and executable scenarios.

## Tests before implementation

- [x] Add `tests/telegram-text-import-v1.mjs` encoding every scenario of the spec delta.
- [x] Confirm the new test fails on the current `develop`.

## Adapter

- [x] Create `telegram-text-import-v1.js` as a lazy module exposing `window.ampMusicTelegramText1`.
- [x] Implement `parseLines`: separator detection, chat-prefix stripping, conservative rejection.
- [x] Implement `importText`: one `window.importTracks` call, source order, no provider id, no
      network, no playback.
- [x] Report `lines · tracks · new · already saved` and a plain message when nothing is recognised.
- [x] Cap one import at 300 distinct recordings and report the remainder, so an unbounded paste
      cannot block the main thread in the core's `title + artist` deduplication scan.
- [x] Keep provenance local: `Telegram` / `Text import` badges and the raw line, never an Ámpula
      observation source field.

## Unified entry

- [x] Add the `Paste a list` toggle and the hidden textarea panel to `index.html`.
- [x] Style the panel alongside the existing `.fast-import` styles.
- [x] Load the adapter lazily from `fast-import-v150.js` on toggle and on a multi-line paste.
- [x] Keep every new DOM lookup optional so the minimal-document tests keep booting the module.

## Existing contracts

- [x] Keep `tests/fast-import-v142.mjs`, `tests/ui-polish-v150.mjs`,
      `tests/apple-album-source-v150.mjs`, `tests/unified-music-entry.mjs` and
      `tests/repository-integrity-v1.mjs` green.
- [x] Keep `tests/performance-v150.mjs` green without raising a budget.

## Completion

- [x] Run every `tests/*.mjs` and `verify-*.mjs`.
- [x] Update `README.md` for the new user-visible import source.
