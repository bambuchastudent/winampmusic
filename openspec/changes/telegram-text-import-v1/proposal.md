# Proposal: import a musical moment from pasted Telegram text

## Problem

The way people actually pass music to each other is a line of text:

```text
Massive Attack — Teardrop
```

There is no YouTube id, no Apple catalog id, no provider URL. Until `unresolved-tracks-v1` the
working library could not hold such a recording at all, so ÁmpulaMP had nothing to offer for the
most common shape of a shared moment. `unresolved-tracks-v1/proposal.md` names it explicitly:
"The same limitation blocks any source that knows a recording but no provider item, which is the
normal shape of a Telegram or plain-text import."

That constraint is gone. `window.importTracks([{ title, artist }])` now stores a real recording with
a local identifier, deduplicates on normalized `title + artist`, and adopts a playable handle later
without creating a second row. Nothing consumes that yet: every import path in the runtime still
starts from a provider URL.

The unified entry (`#fastImportForm`) accepts one line and routes it to a YouTube text search or to a
provider URL adapter. Pasting twelve chat lines into it does nothing useful — a single-line
`<input type="search">` collapses the newlines and the whole blob is searched as one query.

## Goal

Make pasted human-readable text a first-class import source, and make it the first real consumer of
the provider-independent recording domain.

- A user pastes several lines of `Artist — Title` and gets those recordings in the library.
- Each recognised line becomes an unresolved recording immediately: no provider lookup, no network
  call, no resolver, no playback.
- Identity and deduplication are exactly the ones the library already owns; the adapter adds none.
- The parser is conservative: chat noise, URLs and ordinary sentences are skipped, not guessed at.

## Scope

- A new lazy adapter module `telegram-text-import-v1.js` owning the line parser, the import call and
  the status copy.
- A paste-a-list panel inside the existing `.fast-import` section, opened from the unified entry.
- Routing in `fast-import-v150.js`: a multi-line paste on the unified input, and an explicit toggle,
  both lazily load the adapter.
- Provenance kept as local metadata: badges `Telegram` / `Text import` and the original line.

## Non-goals

- Telegram Bot API, MTProto, authentication, account reading, a server, sync, or downloading audio
  from Telegram. v1 is text the user already has.
- Machine-learning, LLM or network-assisted parsing, and any heuristic beyond a separator and an
  obvious chat prefix.
- Generating a provider identifier, searching YouTube during import, or blocking the import on the
  resolver.
- Starting playback after the import.
- Recording Telegram as an Ámpula provider observation. Pasted text is not a stable item reference.
- Changing the Ámpula Core format, the sharing flow, `fast-player-v141.js`, or any existing importer.
- A separate deduplication rule next to the library core.

## Success criteria

- Pasting the four lines below adds four unresolved recordings in that order.

  ```text
  Massive Attack — Teardrop
  The xx - Intro
  Portishead – Roads
  Артист — Название песни
  ```

- `13:42 Dmitry: Massive Attack — Teardrop` and `Massive Attack — Teardrop` are the same recording.
- `massive attack —   teardrop` does not create a second row next to `Massive Attack — Teardrop`.
- A Telegram import of a recording that is already resolved through YouTube or Apple leaves one row,
  still playable.
- The import performs no `fetch` and no resolver call.
- The status reads like `12 lines · 8 tracks · 6 new · 2 already saved`.
- Text with nothing recognisable reports that plainly and raises nothing.
- Sharing the result produces Core v1 tracks with the real `title`/`artists` and no observation for
  the local recording identifier.
