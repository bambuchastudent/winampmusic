# Design — Apple album source correctness

## Routing
The fast import form keeps its current single-field UX. A capture-phase album router recognizes `music.apple.com/<storefront>/album/.../<collectionId>` only when no `?i=<trackId>` is present. Album links with `?i=` remain single-track links.

## Metadata
Album metadata is read from Apple's public iTunes lookup JSONP endpoint using the collection id, `entity=song`, and the link storefront. Only `kind=song` rows whose `collectionId` exactly matches the supplied album id are accepted. Track order is preserved by `trackNumber`.

## Resolution
Each Apple song is sent through the existing strict Apple → current-source matcher. Unresolved songs are skipped rather than replaced by unrelated content.

## Playback
Resolved Apple songs keep Apple provenance in local library metadata and start through the existing direct-audio path. A small guard blocks legacy `window.playIndex` for Apple-provenance rows, preventing a failed direct source from silently entering the YouTube iframe/ad path. Ordinary YouTube rows are unchanged.
