# Design: Telegram text import

## Ownership

The parser is a provider adapter, so it lives outside the synchronous core in its own module,
`telegram-text-import-v1.js`, loaded lazily on first use. `unresolved-tracks-v1/design.md` put
recording identity, deduplication and local identifiers in `fast-player-v141.js` and made adapters
hand recordings to `window.importTracks` without deciding whether a recording may exist. This change
keeps that split exactly: the adapter turns text into `{ title, artist }` and stops there.

`fast-player-v141.js` is not touched. Neither is any existing importer.

| concern | owner |
|---|---|
| what a line means | `telegram-text-import-v1.js` |
| recording identity, dedup, local id, handle adoption | `fast-player-v141.js` `importTracks` |
| when the adapter is loaded | `fast-import-v150.js` |
| where the user pastes | `index.html` `.fast-import` panel |

## The line grammar

One line is one recording:

```text
<artist> <separator> <title>
```

`parseLines(text)` splits on `\r?\n`, and for each line applies, in order: prefix stripping,
separator detection, side validation. A line that fails any step is skipped, never guessed at.

### Separators

| separator | required spacing | reason |
|---|---|---|
| `—` em dash | any, including none | never occurs inside a word |
| `–` en dash | any, including none | never occurs inside a word |
| `-` hyphen | at least one space on **both** sides | occurs inside `Jay-Z`, `Anne-Marie`, `Twenty-One Pilots` |

The hyphen restriction is the one place where this design deliberately narrows the requested
"whitespace around the separator may be anything". Accepting `Jay-Z` as artist `Jay` / title `Z`
would manufacture a recording that nobody sent, which is worse than skipping a line: an invented
recording enters identity, gets a local id, is exported into an Ámpula and is offered to a receiver's
resolver. Skipping is recoverable by the user, inventing is not. `Artist - Title`, the form the
requirement actually shows, keeps working.

The **first** valid separator splits the line, so `Massive Attack — Teardrop — live 1998` keeps
`Teardrop — live 1998` as the title rather than losing the version label.

### Telegram prefixes

Two prefixes are removed, both purely positional, neither of them a guess about content:

1. a leading clock, `13:42`, `13:42:07`, `[13:42]`, optionally followed by `AM`/`PM`;
2. a leading `Name: `, at most 40 characters, containing no separator.

The separator check on the name is what protects a title that contains a colon:
`Nine Inch Nails — Something I Can Never Have: live` would otherwise have `Nine Inch Nails —
Something I Can Never Have` stripped as if it were a chat author. Because that candidate name
contains `—`, it is not a name and nothing is stripped.

Anything else Telegram exports — `Forwarded from`, reply quotes, reactions, a date header on its own
line — carries no separator and is skipped by the ordinary rule.

### Rejections

A line is skipped when it is empty, when it has no valid separator, when either side is empty after
trimming, when either side is URL-like (`http://`, `https://`, `www.`, or a bare `host.tld/…`), or
when the line exceeds 300 characters or a side exceeds 120. The length limits are not heuristics
about meaning; they are a bound that keeps a pasted paragraph containing a stray ` - ` from becoming
a recording.

An ordinary sentence with no separator is skipped by construction. A sentence that does contain
` - ` is accepted in v1, and that is a deliberate limit rather than an oversight: distinguishing it
would require exactly the semantic parsing this change refuses to add.

## Import

`importText(text, options)` builds one item per recognised line:

```js
{ title, artist, badges: ['Telegram', 'Text import'], importedAt, sourceLine }
```

and calls `window.importTracks(items)` once, in source order.

No `id`, no provider lookup, no `fetch`, no `playIndex`. The adapter never touches the resolver; a
source is searched only later, when the user plays the track, through the path
`unresolved-tracks-v1` already specified.

Duplicate lines inside one paste collapse before the call so the status can count recordings rather
than repeated lines. That is presentation arithmetic, not a second identity rule: it uses
`window.ampMusicRecordingId`, the identity function the core exposes, and if the global is absent it
falls back to `importTracks` doing the same job.

### Why one paste is capped at 300 recordings

`importTracks` deduplicates an incoming item that carries `title`/`artist` and no `id` by recomputing
the local recording id of every existing library row, so a single call costs
`items × library`. Every other bulk path avoids that branch or is bounded by a real playlist:
`fast-import-v150.js` passes `{ id }` with no title, and an Apple playlist is as long as a playlist
is. A pasted chat export is the first unbounded input, and it is measurably quadratic — 500 items
take about 100 ms, 2000 items about 1.4 s, 4000 items about 5.6 s of blocked main thread.

The adapter therefore forwards at most 300 distinct recordings per import, keeps the first 300 in the
pasted order, and reports the remainder: `450 lines · 300 tracks · 300 new · 150 over the 300 track
limit`. The user can paste the rest in a second batch. The cap belongs to the adapter, not to the
core: making `importTracks` cheaper would mean adding an index to the synchronous core for a case no
current caller reaches, and `unresolved-tracks-v1` deliberately keeps that domain small. 300 is also
consistent with the product — an Ámpula is a moment, not a library migration.

Everything else about identity is delegated:

- `massive attack —   teardrop` and `Massive Attack — Teardrop` are one recording because
  `importTracks` normalises whitespace and case;
- an already resolved recording absorbs the Telegram line without a second row, and keeps its handle,
  because the incoming item carries no playable id;
- a later Apple/YouTube import of the same recording adopts the handle into the existing row;
- two identical titles by different artists stay two recordings.

## Status copy

```text
12 lines · 8 tracks · 6 new · 2 already saved
```

`lines` counts non-empty lines, `tracks` counts recognised distinct recordings, `new` is
`importTracks().added`, `already saved` is the remainder. The last segment is omitted when it is
zero, matching the way `apple-import-resilience-v1` omits its zero `unresolved` segment.

Nothing recognised is not an error: `12 lines · no Artist — Title lines found`. Empty input reports
`Paste lines like Artist — Title`. Neither raises.

## Provenance

Provenance is local metadata only. `badges: ['Telegram', 'Text import']` marks the source kind, and
`sourceLine` keeps the raw line for the user's own recall.

`sourceLine` is deliberately not called `sourceUrl`, `url`, `originUrl` or `appleTrackUrl`:
`compact-share.js` `trackObservations` reads exactly those four fields and turns them into Ámpula
observations. A pasted chat line is not a stable provider item reference — `ampula/README.md` defines
an observation as a representation that was known to exist at some time — so it must not leak into
Core v1. Under this design `toAmpula` sees no observation source on a Telegram-imported track and
emits `title` + `artists` only, which is exactly right: the local recording id is 12 characters and
already fails `VIDEO_ID_RE`, so it cannot be published as a YouTube observation either.

No new Ámpula field, no new service name, no format change.

## UI wiring

The unified entry stays one entry. `index.html` gains, inside the existing `.fast-import` section, a
`Paste a list` toggle and a hidden panel with a `<textarea>` and an `Import lines` button. The
adapter is loaded on demand from `fast-import-v150.js` in two situations:

1. the toggle is pressed;
2. a multi-line paste lands on `#fastImportInput` — the paste is cancelled and its text is handed to
   the panel, because a single-line `<input type="search">` would otherwise silently join the lines.

`fast-import-v150.js` gains a loader and those two listeners, and no parsing. Its existing single-line
routing is untouched: a URL still goes to the YouTube/Apple adapters and one line of free text still
goes to the YouTube search installed by `unified-entry-v152.js`.

All new DOM lookups are optional. `tests/ui-polish-v150.mjs`, `tests/fast-import-v142.mjs` and
`tests/apple-album-source-v150.mjs` boot `fast-import-v150.js` against a minimal document that has
only the form, the input, the button and the hint, so the module must stay silent when the panel is
absent.

## Compatibility

- No storage key, runtime marker, existing status string or public API changes.
- `window.importTracks` is called with its existing shape and its `{ added, total }` result.
- The new module is lazy and absent from `index.html`, so the synchronous startup budget and the
  19000-byte core source budget in `tests/performance-v150.mjs` are untouched, and no performance
  budget is raised by this change.
- The module is precached by `sw.js` alongside the other on-demand import adapters
  (`apple-music-import-v064.js`, `apple-playlist-import-v150.js`). Text import is the one import that
  needs no network at all, so it should keep working offline; the `CACHE` name is unchanged because a
  new `sw.js` body re-runs `install` and fills the same cache.

## Failure modes

| failure | behaviour |
|---|---|
| textarea empty | status asks for `Artist — Title` lines, nothing imported |
| more than 300 recognised recordings | the first 300 are imported, the remainder is reported in the status |
| no line recognised | status reports the line count and that nothing was recognised, nothing imported |
| every recording already saved | `N tracks · 0 new · N already saved`, nothing duplicated |
| `window.importTracks` missing (core not started) | status reports the player is still starting, nothing lost |
| adapter script fails to load | the unified entry reports text import unavailable, links keep working |
| a line is chat noise | skipped, counted only in `lines` |
| clipboard text unavailable on paste | the paste falls through to the existing single-line behaviour |
