# Tasks: dialogless short-link sharing v1.6.5

- [x] Record the product rule that primary share/receive flows do not use custom dialogs.
- [x] Suppress the sender share modal while preserving canonical Ámpula link generation.
- [x] Copy the canonical link immediately as a failure-safe fallback.
- [x] Promote a successfully minted short alias to the final clipboard value.
- [x] Render received shared music inline in the main library area instead of a modal.
- [x] Preserve direct received-track playback and explicit `Add to library` behavior.
- [x] Restore the local-library surface when leaving a received share.
- [x] Add regression coverage for the dialogless contract.
- [ ] Verify the production short-link relay configuration separately; dialogless sharing must still work with the canonical fallback when no relay is configured.
