# Design — full-library background resolution v1.7.5

## Architecture

The existing `playback-prefetch-v165.js` compatibility surface remains loaded, but its policy changes from `2 ahead` to a bounded full-library resolver. Keeping the compatibility object avoids breaking callers while replacing the policy behind it.

### Full-library resolver

- Scan every library row that still needs final-trusted playback resolution.
- Resolve with a small fixed worker pool (`4` workers) instead of two positional targets.
- Keep one in-flight promise per recording identity so playback, queue recovery and background resolution share work instead of duplicating requests.
- Allow each recording resolution job to live for up to `120000 ms`.
- Re-run once after the current pass if the library changed while a pass was already running.
- Trigger a pass after library imports, on startup, and after playback begins.

The resolver updates only local playback fields (`id`, YouTube match fields, playback provider/badge). The existing canonical title/artist/origin fields win when persisting a match.

### Deeper recall

`resolver-music-recall-v174.js` keeps its compatibility filename/global but moves to the v1.7.5 policy:

- a track-level search budget of `120000 ms`;
- per-request timeout long enough for slow public instances (`12000 ms`);
- multiple query plans (`music_songs`, generic `videos`, official-audio/topic variants);
- Piped `/nextpage/search` pagination, capped per query plan;
- parallel instance workers, with the first final-trusted candidate winning and aborting the remaining workers.

This discovery layer does not grant trust. Every candidate is still validated by `ampulaResolverTrust167.validate` before it can be returned.

## Playback continuity

The rolling queue no longer assumes only two prepared tracks or a twelve-row scan window. If a requested row is unresolved, it leaves that resolution running in the background and looks across the complete library for another final-trusted playable row. A ready row is played immediately; background resolution continues for misses.

A manual click on an unresolved row follows the same continuity rule: try that recording, but do not strand playback if another row is already playable.

## Concurrency and failure modes

- Four workers bound aggregate full-library resolution traffic.
- Per-recording time budget prevents permanently hung searches.
- Per-request timeout allows slow endpoints to fail independently without consuming the whole recording budget.
- Instance/network failures return `null` and preserve the unresolved row.
- Final-trust rejection preserves canonical metadata and never falls back to a known-wrong ID.
- A new library import during an active full pass schedules one more pass after the current one.

## Compatibility

Historical globals/file names (`ampulaPlaybackPrefetch165`, `resolver-music-recall-v174.js`) stay available so existing consumers and tests do not need a flag-day migration. New fields expose the v1.7.5 mode, worker count and time budget.
