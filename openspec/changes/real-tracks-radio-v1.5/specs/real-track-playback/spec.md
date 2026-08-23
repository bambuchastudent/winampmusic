# Spec: real-track playback and Radio

## Requirement: deterministic Apple import matching
When AmpMusic imports an Apple Music track or playlist row, it SHALL only persist a YouTube source when the candidate strongly matches the Apple title and artist. Unicode titles SHALL remain searchable. A candidate that looks like an advertisement, commercial, promo, trailer, review, reaction, cover, remix, sped/slowed/nightcore or unrelated live variant SHALL NOT be used unless that variant is present in the Apple source metadata.

If Apple duration and candidate duration are both known, a materially different duration SHALL cause the candidate to be rejected. If no safe candidate is found, that row SHALL remain unresolved and SHALL NOT be replaced by a lower-confidence video.

## Requirement: imported Apple playback
Apple-imported rows SHALL prefer direct audio for the exact matched video id by resolving a public Piped stream response at playback time. Ordinary pasted YouTube rows SHALL continue to use the current FAST YouTube iframe player.

If a previously persisted Apple row was matched by an older permissive resolver, playback SHALL re-run strict matching from its stored Apple title/artist/duration and MAY repair the persisted video id before audio starts.

If direct audio cannot be resolved, AmpMusic MAY fall back to the existing YouTube iframe for the exact strict-matched video id.

## Requirement: Radio isolation
AmpMusic SHALL expose an explicit Radio control. Related/recommended tracks SHALL be opt-in through Radio and SHALL NOT be used as fallback truth for deterministic Apple imports. A Radio selection SHALL exclude the current video id and obvious ad/promo/noisy results.

## Requirement: version/UI stability
The public product SHALL remain AmpMusic 1.5. The existing import field and overall UI layout SHALL remain; Radio is an additional player control, not a new import workflow.
