# Proposal — Apple album source correctness

## Problem
AmpMusic 1.5 currently treats a bare Apple Music album URL as if the album collection id were a song id. The Apple lookup can then return a song unrelated to the user's album intent, after which playback may fall through to the YouTube iframe and expose advertising.

Exact regression URL:
`https://music.apple.com/tr/album/last-october/1445697454`

## Change
- recognize bare Apple Music album URLs as albums, not tracks;
- read the album's real Apple song rows by collection id;
- strictly resolve each song to the existing current source locator;
- start the first safely resolved album track through direct audio;
- never fall back from an Apple-imported track to the YouTube iframe/ad path;
- preserve ordinary YouTube import/playback and public AmpMusic version 1.5.
