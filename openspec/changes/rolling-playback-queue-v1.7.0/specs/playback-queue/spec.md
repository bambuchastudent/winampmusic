# Playback queue contract v1.7.0

## Two playable ahead
When playback starts at row N, ÁmpulaMP MUST keep searching forward until either two trusted/playable future rows are available or the bounded scan limit is reached. A failed strict-resolution row MUST NOT count as one of the two playable-ahead rows.

## Strict unresolved preservation
Given canonical Spotify origin `God Shaped Hole / Youri Lentjes / 180s`, the candidate `Back Roads 2018 Youri Lentjes - God Shaped Hole / 205s` MUST remain rejected because its duration delta is 25 seconds. The origin row MUST remain present and unresolved.

## Automatic rollover
When the active YouTube track emits ENDED and the immediate next origin row cannot be strictly resolved, playback MUST continue to the next later trusted/playable row within the bounded scan window. The failed row MUST NOT be deleted or replaced with a weak candidate.

## Manual selection
When a user manually selects an unresolved origin row and strict resolution fails, the player MUST stay fail-closed and MUST NOT silently play another playlist row.

## Cache durability
After a strict resolution succeeds, the YouTube id, `youtubeMatchId`, resolver trust marker, playback provider, and canonical title/artist MUST remain in `winampmusic.library.v1`. FAST's live playback library MUST receive the resolved id. Replaying that cached trusted row MUST NOT invoke the resolver again.

## Advertisement badge
During active playback of a canonical Spotify/Apple origin row, if the iframe-reported media duration differs from canonical duration by more than 16 seconds, the green player screen MUST show a compact yellow `AD mm:ss` badge on the right side of the same top row as `PLAYING`. The timer MUST represent estimated remaining time (`reported duration - reported elapsed`).

When reported duration returns within the accepted canonical range, the badge MUST hide immediately. The UI MUST NOT claim ad title, click-through URL, or skip availability because those are not exposed by the supported YouTube iframe API.